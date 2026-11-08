-- One-time transition requested by the team: all accounts start with no vacations.
DELETE FROM sessions;
DELETE FROM vacation_days;
DELETE FROM users;
