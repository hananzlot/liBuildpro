
-- Delete 4 duplicate offset bill records (created by double-submit race condition)
-- These are exact duplicates (same bill_ref, vendor, amount, millisecond-exact created_at)
-- The target bill (Urban Main $220K) already has the correct amount ($206,447.87)
-- so no balance adjustment is needed.

DELETE FROM project_bills WHERE id = '93a84020-4de0-4b72-b1b0-2637931a0bdb'; -- Anawalt "Paid by Yogi" $1,134.71 (dupe of 531d1753)
DELETE FROM project_bills WHERE id = '4500550d-1182-4778-a8e5-2b80aafa592b'; -- J & B Materials "58275-00" $3,972.60 (dupe of 04c06c20)
DELETE FROM project_bills WHERE id = 'ea474dad-fa32-4812-bde9-222ef5cd4096'; -- Anawalt "Yogi Paid" $78.74 (dupe of a6a199fd)
DELETE FROM project_bills WHERE id = '0dc17fb0-657f-40bd-b0b3-b1a3bd70139c'; -- Anawalt "Asher Paid" $46.08 (dupe of 9b9480b8)
