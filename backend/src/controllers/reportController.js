const pool = require("../config/db");
const PDFDocument = require("pdfkit");

const getTodayDate = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Get daily job report
const getDailyReport = async (req, res) => {
  const reportDate = req.query.date || getTodayDate();

  const validDateFormat = /^\d{4}-\d{2}-\d{2}$/;

  if (!validDateFormat.test(reportDate)) {
    return res.status(400).json({
      message: "Date must use YYYY-MM-DD format",
    });
  }

  try {
    const [summaryResults] = await pool.execute(
      `SELECT
         COUNT(*) AS total_jobs,
         SUM(status = 'Pending') AS pending_jobs,
         SUM(status = 'Assigned') AS assigned_jobs,
         SUM(status = 'In Progress') AS in_progress_jobs,
         SUM(status = 'Completed') AS completed_jobs,
         SUM(status = 'Cancelled') AS cancelled_jobs,
         COALESCE(SUM(estimated_cost), 0) AS total_estimated_cost,
         COALESCE(SUM(CASE WHEN status = 'Completed' THEN final_cost ELSE 0 END), 0) AS total_final_cost
       FROM jobs
       WHERE received_date = ?`,
      [reportDate]
    );

    const [jobs] = await pool.execute(
      `SELECT
         j.job_id,
         v.vehicle_number,
         c.name AS customer_name,
         u.name AS technician_name,
         j.problem_description,
         j.status,
         j.received_date,
         j.expected_date,
         j.completed_date,
         j.estimated_cost,
         j.final_cost
       FROM jobs j
       INNER JOIN vehicles v
         ON j.vehicle_id = v.vehicle_id
       INNER JOIN customers c
         ON v.customer_id = c.customer_id
       LEFT JOIN users u
         ON j.technician_id = u.user_id
       WHERE j.received_date = ?
       ORDER BY j.job_id DESC`,
      [reportDate]
    );

    return res.json({
      report_type: "Daily Report",
      report_date: reportDate,
      summary: summaryResults[0],
      jobs,
    });
  } catch (error) {
    console.error("Daily report error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Get monthly job report
const getMonthlyReport = async (req, res) => {
  const reportMonth = req.query.month;

  const validMonthFormat = /^\d{4}-\d{2}$/;

  if (!reportMonth || !validMonthFormat.test(reportMonth)) {
    return res.status(400).json({
      message: "Month must use YYYY-MM format",
    });
  }

  try {
    const [summaryResults] = await pool.execute(
      `SELECT
         COUNT(*) AS total_jobs,
         SUM(status = 'Pending') AS pending_jobs,
         SUM(status = 'Assigned') AS assigned_jobs,
         SUM(status = 'In Progress') AS in_progress_jobs,
         SUM(status = 'Completed') AS completed_jobs,
         SUM(status = 'Cancelled') AS cancelled_jobs,
         COALESCE(SUM(estimated_cost), 0) AS total_estimated_cost,
         COALESCE(SUM(CASE WHEN status = 'Completed' THEN final_cost ELSE 0 END), 0) AS total_final_cost
       FROM jobs
       WHERE DATE_FORMAT(received_date, '%Y-%m') = ?`,
      [reportMonth]
    );

    const [jobs] = await pool.execute(
      `SELECT
         j.job_id,
         v.vehicle_number,
         c.name AS customer_name,
         u.name AS technician_name,
         j.problem_description,
         j.status,
         j.received_date,
         j.expected_date,
         j.completed_date,
         j.estimated_cost,
         j.final_cost
       FROM jobs j
       INNER JOIN vehicles v
         ON j.vehicle_id = v.vehicle_id
       INNER JOIN customers c
         ON v.customer_id = c.customer_id
       LEFT JOIN users u
         ON j.technician_id = u.user_id
       WHERE DATE_FORMAT(j.received_date, '%Y-%m') = ?
       ORDER BY j.received_date DESC`,
      [reportMonth]
    );

    return res.json({
      report_type: "Monthly Report",
      report_month: reportMonth,
      summary: summaryResults[0],
      jobs,
    });
  } catch (error) {
    console.error("Monthly report error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Convert values safely for a CSV file
const escapeCsvValue = (value) => {
  let text = value === null || value === undefined
    ? ""
    : String(value);

  // Prevent spreadsheet applications from interpreting exported text as a formula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
};

// Export monthly report as CSV
const exportMonthlyReportCsv = async (req, res) => {
  const reportMonth = req.query.month;
  const validMonthFormat = /^\d{4}-\d{2}$/;

  if (!reportMonth || !validMonthFormat.test(reportMonth)) {
    return res.status(400).json({
      message: "Month must use YYYY-MM format",
    });
  }

  try {
    const [jobs] = await pool.execute(
      `SELECT
         j.job_id,
         v.vehicle_number,
         c.name AS customer_name,
         u.name AS technician_name,
         j.problem_description,
         j.status,
         j.received_date,
         j.expected_date,
         j.completed_date,
         j.estimated_cost,
         j.final_cost
       FROM jobs j
       INNER JOIN vehicles v
         ON j.vehicle_id = v.vehicle_id
       INNER JOIN customers c
         ON v.customer_id = c.customer_id
       LEFT JOIN users u
         ON j.technician_id = u.user_id
       WHERE DATE_FORMAT(j.received_date, '%Y-%m') = ?
       ORDER BY j.received_date DESC`,
      [reportMonth]
    );

    const headers = [
      "Job ID",
      "Vehicle Number",
      "Customer Name",
      "Technician Name",
      "Problem Description",
      "Status",
      "Received Date",
      "Expected Date",
      "Completed Date",
      "Estimated Cost",
      "Final Cost",
    ];

    const rows = jobs.map((job) => [
      job.job_id,
      job.vehicle_number,
      job.customer_name,
      job.technician_name,
      job.problem_description,
      job.status,
      job.received_date,
      job.expected_date,
      job.completed_date,
      job.estimated_cost,
      job.final_cost,
    ]);

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="monthly-report-${reportMonth}.csv"`
    );

    return res.send(`\uFEFF${csvContent}`);
  } catch (error) {
    console.error(
      "Monthly CSV export error:",
      error.message
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Export monthly report as PDF
const exportMonthlyReportPdf = async (req, res) => {
  const reportMonth = req.query.month;
  const validMonthFormat = /^\d{4}-\d{2}$/;

  if (!reportMonth || !validMonthFormat.test(reportMonth)) {
    return res.status(400).json({
      message: "Month must use YYYY-MM format",
    });
  }

  try {
    const [summaryResults] = await pool.execute(
      `SELECT
         COUNT(*) AS total_jobs,
         SUM(status = 'Pending') AS pending_jobs,
         SUM(status = 'Assigned') AS assigned_jobs,
         SUM(status = 'In Progress') AS in_progress_jobs,
         SUM(status = 'Completed') AS completed_jobs,
         SUM(status = 'Cancelled') AS cancelled_jobs,
         COALESCE(SUM(estimated_cost), 0) AS total_estimated_cost,
         COALESCE(SUM(CASE WHEN status = 'Completed' THEN final_cost ELSE 0 END), 0) AS total_final_cost
       FROM jobs
       WHERE DATE_FORMAT(received_date, '%Y-%m') = ?`,
      [reportMonth]
    );

    const [jobs] = await pool.execute(
      `SELECT
         j.job_id,
         v.vehicle_number,
         c.name AS customer_name,
         u.name AS technician_name,
         j.problem_description,
         j.status,
         j.received_date,
         j.expected_date,
         j.completed_date,
         j.estimated_cost,
         j.final_cost
       FROM jobs j
       INNER JOIN vehicles v
         ON j.vehicle_id = v.vehicle_id
       INNER JOIN customers c
         ON v.customer_id = c.customer_id
       LEFT JOIN users u
         ON j.technician_id = u.user_id
       WHERE DATE_FORMAT(j.received_date, '%Y-%m') = ?
       ORDER BY j.received_date DESC`,
      [reportMonth]
    );

    const summary = summaryResults[0];

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="monthly-report-${reportMonth}.pdf"`
    );

    const document = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    document.pipe(res);

    document
      .fontSize(20)
      .text("Workshop Job Tracker", {
        align: "center",
      });

    document
      .fontSize(16)
      .text("Monthly Repair Job Report", {
        align: "center",
      });

    document
      .fontSize(12)
      .text(`Report Month: ${reportMonth}`, {
        align: "center",
      });

    document.moveDown();

    document
      .fontSize(14)
      .text("Report Summary", {
        underline: true,
      });

    document.fontSize(11);
    document.text(`Total Jobs: ${summary.total_jobs}`);
    document.text(`Pending Jobs: ${summary.pending_jobs || 0}`);
    document.text(`Assigned Jobs: ${summary.assigned_jobs || 0}`);
    document.text(
      `In Progress Jobs: ${summary.in_progress_jobs || 0}`
    );
    document.text(
      `Completed Jobs: ${summary.completed_jobs || 0}`
    );
    document.text(
      `Cancelled Jobs: ${summary.cancelled_jobs || 0}`
    );
    document.text(
      `Total Estimated Cost: LKR ${summary.total_estimated_cost}`
    );
    document.text(
      `Total Final Cost: LKR ${summary.total_final_cost}`
    );

    document.moveDown();

    document
      .fontSize(14)
      .text("Repair Job Details", {
        underline: true,
      });

    document.moveDown(0.5);

    if (jobs.length === 0) {
      document.fontSize(11).text(
        "No repair jobs found for this month."
      );
    } else {
      jobs.forEach((job, index) => {
        if (document.y > 680) {
          document.addPage();
        }

        document
          .fontSize(12)
          .text(`${index + 1}. Job ID: ${job.job_id}`, {
            underline: true,
          });

        document.fontSize(10);
        document.text(
          `Vehicle Number: ${job.vehicle_number}`
        );
        document.text(`Customer: ${job.customer_name}`);
        document.text(
          `Technician: ${job.technician_name || "Not Assigned"}`
        );
        document.text(`Problem: ${job.problem_description}`);
        document.text(`Status: ${job.status}`);
        document.text(`Received Date: ${job.received_date}`);
        document.text(
          `Expected Date: ${job.expected_date || "-"}`
        );
        document.text(
          `Completed Date: ${job.completed_date || "-"}`
        );
        document.text(
          `Estimated Cost: LKR ${job.estimated_cost}`
        );
        document.text(`Final Cost: LKR ${job.final_cost}`);

        document.moveDown();
      });
    }

    document.end();
  } catch (error) {
    console.error(
      "Monthly PDF export error:",
      error.message
    );

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
};

module.exports = {
  getDailyReport,
  getMonthlyReport,
  exportMonthlyReportCsv,
  exportMonthlyReportPdf,
};
