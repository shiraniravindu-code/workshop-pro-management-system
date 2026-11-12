CREATE DATABASE IF NOT EXISTS workshop_job_tracker;

USE workshop_job_tracker;

-- Users table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'technician') NOT NULL DEFAULT 'technician',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    vehicle_number VARCHAR(30) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(50),
    manufacture_year INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vehicle_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Workshop jobs table
CREATE TABLE jobs (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    technician_id INT NULL,
    problem_description TEXT NOT NULL,
    repair_notes TEXT,
    status ENUM(
        'Pending',
        'Assigned',
        'In Progress',
        'Completed',
        'Cancelled'
    ) NOT NULL DEFAULT 'Pending',
    received_date DATE NOT NULL,
    expected_date DATE,
    completed_date DATE,
    estimated_cost DECIMAL(10, 2) DEFAULT NULL,
    final_cost DECIMAL(10, 2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_job_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(vehicle_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_job_technician
        FOREIGN KEY (technician_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

-- Job status history table
CREATE TABLE job_status_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    status ENUM(
        'Pending',
        'Assigned',
        'In Progress',
        'Completed',
        'Cancelled'
    ) NOT NULL,
    note TEXT,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_history_job
        FOREIGN KEY (job_id)
        REFERENCES jobs(job_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_history_user
        FOREIGN KEY (updated_by)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);
