-- For EXISTING databases only. BACK UP the database first.
-- Check constraint names with SHOW CREATE TABLE vehicles; SHOW CREATE TABLE jobs;
-- Assumes the existing foreign keys have the names from the supplied schema.sql.
USE workshop_job_tracker;

ALTER TABLE vehicles
  DROP FOREIGN KEY fk_vehicle_customer,
  ADD CONSTRAINT fk_vehicle_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE jobs
  DROP FOREIGN KEY fk_job_vehicle,
  ADD CONSTRAINT fk_job_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
