-- Fix prescribed_pace_per_mile column to allow longer values
ALTER TABLE workouts 
ALTER COLUMN prescribed_pace_per_mile TYPE VARCHAR(100);

-- Verify
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'workouts' AND column_name = 'prescribed_pace_per_mile';







