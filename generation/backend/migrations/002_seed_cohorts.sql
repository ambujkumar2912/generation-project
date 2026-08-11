INSERT INTO cohorts (birth_year, label, is_active) VALUES
    (2004, '2004 Generation', TRUE),
    (2005, '2005 Generation', TRUE),
    (2006, '2006 Generation', TRUE),
    (2007, '2007 Generation', TRUE),
    (2008, '2008 Generation', TRUE)
ON CONFLICT (birth_year) DO NOTHING;
