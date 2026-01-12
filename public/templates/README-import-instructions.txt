========================================
PROJECT IMPORT TEMPLATE - INSTRUCTIONS
========================================

OVERVIEW
--------
This import system allows you to migrate projects from your old system into the new platform.
The import consists of 6 CSV files that should be filled out in order:

1. project-import-template.csv      - Main project information
2. agreements-import-template.csv   - Contracts and change orders
3. payment-phases-import-template.csv - Payment milestones
4. invoices-import-template.csv     - Invoices generated
5. payments-import-template.csv     - Payments received
6. bills-import-template.csv        - Bills and expenses


HOW THE LINKING WORKS
---------------------
Each file uses reference columns to link data together:

- project_ref: Unique identifier for each project (used in Projects and Bills)
- agreement_ref: Links agreements to projects and phases to agreements
- phase_ref: Links phases to invoices
- invoice_ref: Links invoices to payments

Example flow:
  PROJ-001 (project) 
    → AGR-001 (agreement for PROJ-001)
      → PH-001 (phase for AGR-001)
        → INV-001 (invoice for PH-001)
          → Payment record (payment for INV-001)
    → BILL-001 (bill for PROJ-001, optionally linked to AGR-001)


REQUIRED FIELDS
---------------
Fields marked with (*) in each template are required. Other fields are optional.

Projects: project_ref*, project_name*
Agreements: project_ref*, agreement_ref*, (total_price recommended)
Payment Phases: agreement_ref*, phase_ref*, phase_name*, (amount recommended)
Invoices: phase_ref*, invoice_ref*, (amount recommended)
Payments: invoice_ref*
Bills: project_ref*


DATE FORMAT
-----------
All dates should be in YYYY-MM-DD format.
Examples: 2024-01-15, 2024-12-31


BOOLEAN VALUES
--------------
For yes/no fields (like has_hoa, deposit_verified), use:
- TRUE or FALSE
- Yes or No
- 1 or 0


CURRENCY VALUES
---------------
Enter numbers without currency symbols or commas.
Correct: 25000
Incorrect: $25,000


TIPS FOR SUCCESSFUL IMPORT
--------------------------
1. Start with a few test projects before importing your entire database
2. Make sure all reference columns match exactly (case-sensitive)
3. Remove the example data rows before importing your actual data
4. Keep the header row (first row after the ### instructions ###)
5. Save files as CSV (Comma Separated Values) format
6. Review the imported data after each batch for accuracy


COMMON FIELD VALUES
-------------------
project_status: New, In Progress, On Hold, Completed, Cancelled
project_type: Roofing, Kitchen, Bathroom, Siding, Windows, HVAC, etc.
install_status: Not Started, Scheduled, In Progress, Complete, On Hold
payment_status: Pending, Scheduled, Received
payment_schedule: Due on Receipt, Net 15, Net 30, Net 45, Net 60
category (bills): Materials, Labor, Subcontractor, Permits, Equipment, Other


SUPPORT
-------
If you encounter issues during import, please contact support with:
- The CSV file that failed
- Any error messages received
- The row number where the error occurred


========================================
