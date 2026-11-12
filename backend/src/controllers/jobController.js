const pool = require("../config/db");

// Return the current date in Sri Lanka as YYYY-MM-DD.
// toISOString() uses UTC and can return the previous date in Sri Lanka.
function getSriLankaDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

// Create a new repair job
const createJob = async (req, res) => {
  const {
    vehicle_id,
    technician_id,
    problem_description,
    received_date,
    expected_date,
    estimated_cost,
  } = req.body;

  if (!vehicle_id || !problem_description || !received_date) {
    return res.status(400).json({
      message:
        "Vehicle, problem description and received date are required",
    });
  }

  if (expected_date && expected_date < received_date) {
    return res.status(400).json({
      message: "Expected date cannot be before received date",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [vehicles] = await connection.execute(
      "SELECT vehicle_id FROM vehicles WHERE vehicle_id = ?",
      [vehicle_id]
    );

    if (vehicles.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    if (technician_id) {
      const [technicians] = await connection.execute(
        `SELECT user_id
         FROM users
         WHERE user_id = ?
         AND role = 'technician'
         AND is_active = TRUE`,
        [technician_id]
      );

      if (technicians.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          message: "Active technician not found",
        });
      }
    }

    const status = technician_id ? "Assigned" : "Pending";

    const [result] = await connection.execute(
      `INSERT INTO jobs
       (
         vehicle_id,
         technician_id,
         problem_description,
         status,
         received_date,
         expected_date,
         estimated_cost
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        vehicle_id,
        technician_id || null,
        problem_description.trim(),
        status,
        received_date,
        expected_date || null,
        estimated_cost ?? null,
      ]
    );

    // Record the initial state atomically with the new job.
    await connection.execute(
      `INSERT INTO job_status_history (job_id, status, note, updated_by)
       VALUES (?, ?, ?, ?)`,
      [result.insertId, status, null, req.user.userId]
    );
    await connection.commit();

    return res.status(201).json({
      message: "Repair job created successfully",
      job: {
        jobId: result.insertId,
        vehicle_id,
        technician_id: technician_id || null,
        problem_description: problem_description.trim(),
        status,
        received_date,
        expected_date: expected_date || null,
        estimated_cost: estimated_cost ?? null,
      },
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Create job rollback error:", rollbackError.message);
      }
    }
    console.error("Create job error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get all repair jobs
const getAllJobs = async (req, res) => {
  try {
    // Admins see every job; technicians see only jobs assigned to them.
    const isTechnician = req.user.role === "technician";
    const jobFilter = isTechnician ? "WHERE j.technician_id = ?" : "";
    const queryParams = isTechnician ? [req.user.userId] : [];

    const [jobs] = await pool.execute(
      `SELECT
         j.job_id,
         j.vehicle_id,
         v.vehicle_number,
         v.vehicle_type,
         c.customer_id,
         c.name AS customer_name,
         j.technician_id,
         u.name AS technician_name,
         j.problem_description,
         j.repair_notes,
         j.status,
         j.received_date,
         j.expected_date,
         j.completed_date,
         j.estimated_cost,
         j.final_cost,
         j.created_at,
         j.updated_at
       FROM jobs j
       INNER JOIN vehicles v
         ON j.vehicle_id = v.vehicle_id
       INNER JOIN customers c
         ON v.customer_id = c.customer_id
       LEFT JOIN users u
         ON j.technician_id = u.user_id
       ${jobFilter}
       ORDER BY j.job_id DESC`,
      queryParams
    );

    return res.json({
      total: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("Get jobs error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Get one repair job by ID
const getJobById = async (req, res) => {
  const { id } = req.params;

  try {
    // Return 404 for jobs belonging to another technician.
    const isTechnician = req.user.role === "technician";
    const ownJobFilter = isTechnician ? "AND j.technician_id = ?" : "";
    const queryParams = isTechnician ? [id, req.user.userId] : [id];

    const [jobs] = await pool.execute(
      `SELECT
         j.job_id,
         j.vehicle_id,
         v.vehicle_number,
         v.vehicle_type,
         c.customer_id,
         c.name AS customer_name,
         j.technician_id,
         u.name AS technician_name,
         j.problem_description,
         j.repair_notes,
         j.status,
         j.received_date,
         j.expected_date,
         j.completed_date,
         j.estimated_cost,
         j.final_cost,
         j.created_at,
         j.updated_at
       FROM jobs j
       INNER JOIN vehicles v
         ON j.vehicle_id = v.vehicle_id
       INNER JOIN customers c
         ON v.customer_id = c.customer_id
       LEFT JOIN users u
         ON j.technician_id = u.user_id
       WHERE j.job_id = ?
       ${ownJobFilter}`,
      queryParams
    );

    if (jobs.length === 0) {
      return res.status(404).json({
        message: "Repair job not found",
      });
    }

    return res.json({
      job: jobs[0],
    });
  } catch (error) {
    console.error("Get job error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Update a repair job
const updateJob = async (req, res) => {
  const { id } = req.params;

  const {
    vehicle_id,
    technician_id,
    problem_description,
    repair_notes,
    status,
    received_date,
    expected_date,
    completed_date,
    estimated_cost,
    final_cost,
  } = req.body;

  const allowedStatuses = [
    "Pending",
    "Assigned",
    "In Progress",
    "Completed",
    "Cancelled",
  ];

  if (!vehicle_id || !problem_description || !received_date || !status) {
    return res.status(400).json({
      message:
        "Vehicle, problem description, received date and status are required",
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid job status",
    });
  }

  if (expected_date && expected_date < received_date) {
    return res.status(400).json({
      message: "Expected date cannot be before received date",
    });
  }

  if (completed_date && completed_date < received_date) {
    return res.status(400).json({
      message: "Completed date cannot be before received date",
    });
  }

  if (["Assigned", "In Progress", "Completed"].includes(status) && !technician_id) {
    return res.status(400).json({
      message: "A technician is required for this job status",
    });
  }

  if (status === "Pending" && technician_id) {
    return res.status(400).json({
      message: "A pending job cannot have an assigned technician",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existingJobs] = await connection.execute(
      "SELECT job_id, technician_id, status, DATE_FORMAT(completed_date, '%Y-%m-%d') AS completed_date FROM jobs WHERE job_id = ? FOR UPDATE",
      [id]
    );

    if (existingJobs.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Repair job not found",
      });
    }

    const [vehicles] = await connection.execute(
      "SELECT vehicle_id FROM vehicles WHERE vehicle_id = ?",
      [vehicle_id]
    );

    if (vehicles.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    if (technician_id) {
      const [technicians] = await connection.execute(
        `SELECT user_id
         FROM users
         WHERE user_id = ?
         AND role = 'technician'
         AND is_active = TRUE`,
        [technician_id]
      );

      const retainingExistingTechnician =
        Number(existingJobs[0].technician_id) === Number(technician_id);

      if (technicians.length === 0 && !retainingExistingTechnician) {
        await connection.rollback();
        return res.status(404).json({
          message: "Active technician not found",
        });
      }
    }

    const finalCompletedDate =
      status === "Completed"
        ? completed_date || existingJobs[0].completed_date || getSriLankaDate()
        : null;

    await connection.execute(
      `UPDATE jobs
       SET vehicle_id = ?,
           technician_id = ?,
           problem_description = ?,
           repair_notes = ?,
           status = ?,
           received_date = ?,
           expected_date = ?,
           completed_date = ?,
           estimated_cost = ?,
           final_cost = ?
       WHERE job_id = ?`,
      [
        vehicle_id,
        technician_id || null,
        problem_description.trim(),
        repair_notes ? repair_notes.trim() : null,
        status,
        received_date,
        expected_date || null,
        finalCompletedDate,
        estimated_cost ?? null,
        final_cost ?? null,
        id,
      ]
    );

    if (existingJobs[0].status !== status) {
      await connection.execute(
        `INSERT INTO job_status_history
         (job_id, status, note, updated_by)
         VALUES (?, ?, ?, ?)`,
        [
          id,
          status,
          repair_notes ? repair_notes.trim() : null,
          req.user.userId,
        ]
      );
    }

    await connection.commit();

    return res.json({
      message: "Repair job updated successfully",
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Update job rollback error:", rollbackError.message);
      }
    }
    console.error("Update job error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    if (connection) connection.release();
  }
};

// Update job status
const updateJobStatus = async (req, res) => {
  const { id } = req.params;
  const { status, repair_notes, final_cost } = req.body;

  const technicianStatuses = [
    "In Progress",
    "Completed",
  ];

  const adminStatuses = [
    "Pending",
    "Assigned",
    "In Progress",
    "Completed",
    "Cancelled",
  ];

  const allowedStatuses =
    req.user.role === "admin"
      ? adminStatuses
      : technicianStatuses;

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid job status",
    });
  }

  // Only admins may adjust the final cost, even through a direct API request.
  if (req.user.role === "technician" && final_cost !== undefined) {
    return res.status(403).json({
      message: "Only an admin may change the final cost",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [jobs] = await connection.execute(
      `SELECT job_id, technician_id, status,
              DATE_FORMAT(completed_date, '%Y-%m-%d') AS completed_date
       FROM jobs
       WHERE job_id = ? FOR UPDATE`,
      [id]
    );

    if (jobs.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Repair job not found",
      });
    }

    const job = jobs[0];

    if (
      req.user.role === "technician" &&
      Number(job.technician_id) !== Number(req.user.userId)
    ) {
      await connection.rollback();
      return res.status(403).json({
        message: "This job is not assigned to you",
      });
    }

    if (
      req.user.role === "technician" &&
      ["Completed", "Cancelled"].includes(job.status)
    ) {
      await connection.rollback();
      return res.status(409).json({
        message: "Finished jobs cannot be edited by technicians",
      });
    }

    // Don't reset completion date when an admin saves an already completed job.
    const completedDate =
      status === "Completed"
        ? job.completed_date || getSriLankaDate()
        : null;

    await connection.execute(
      `UPDATE jobs
       SET status = ?,
           repair_notes = COALESCE(?, repair_notes),
           completed_date = ?,
           final_cost = COALESCE(?, final_cost)
       WHERE job_id = ?`,
      [
        status,
        repair_notes ? repair_notes.trim() : null,
        completedDate,
        final_cost ?? null,
        id,
      ]
    );

    if (job.status !== status) {
      await connection.execute(
        `INSERT INTO job_status_history
         (job_id, status, note, updated_by)
         VALUES (?, ?, ?, ?)`,
        [
          id,
          status,
          repair_notes ? repair_notes.trim() : null,
          req.user.userId,
        ]
      );
    }

    await connection.commit();

    return res.json({
      message: "Job status updated successfully",
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Update job status rollback error:", rollbackError.message);
      }
    }
    console.error("Update job status error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    if (connection) connection.release();
  }
};

// Delete a repair job
const deleteJob = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.execute(
      "DELETE FROM jobs WHERE job_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Repair job not found",
      });
    }

    return res.json({
      message: "Repair job deleted successfully",
    });
  } catch (error) {
    console.error("Delete job error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  updateJobStatus,
  deleteJob,
};
