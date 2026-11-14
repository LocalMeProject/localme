-- Initialize core extensions in default postgres DB
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Ensure database 'localme' exists
SELECT 'CREATE DATABASE localme'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'localme')\gexec

-- Switch to localme database and initialize extensions
\connect localme

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
