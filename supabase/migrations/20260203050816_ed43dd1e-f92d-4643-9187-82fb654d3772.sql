UPDATE estimates 
SET ai_analysis = (
  SELECT ai_analysis FROM estimates WHERE estimate_number = 2095
)
WHERE estimate_number = 2094;