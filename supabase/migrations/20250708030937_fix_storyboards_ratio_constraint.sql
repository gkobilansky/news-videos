-- Fix storyboards ratio constraint to include both existing and new portrait ratios
ALTER TABLE storyboards DROP CONSTRAINT storyboards_ratio_check;

ALTER TABLE storyboards ADD CONSTRAINT storyboards_ratio_check 
CHECK (ratio IN ('1280:720', '1584:672', '1104:832', '720:1280', '768:1280', '832:1104', '672:1584'));
