/*
# Add grants for edge-function service role access

1. Purpose
The roster edge function uses the service role key to read and write all roster tables.
While the service role bypasses RLS, it still needs explicit GRANTs on each table.
Several tables (companies, branches, teams, members) currently have NO grants at all,
which means every query from the edge function fails with "permission denied".

2. Changes
- GRANT full CRUD on companies, branches, teams, members, custom_ranks,
  rank_permissions, rank_members, password_change_requests TO service_role.
- Also grant to anon + authenticated on tables the frontend may read directly
  (currently none — all frontend access goes through the edge function, but we
  keep anon/authenticated grants off for locked tables to maintain least privilege).

3. Security
- RLS remains enabled on all tables. These grants only allow the service role
  (used by the edge function with its own auth checks) to operate.
- No policies added yet — the edge function enforces all access control in code.
*/

GRANT SELECT, INSERT, UPDATE, DELETE ON companies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON branches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_ranks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON rank_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON rank_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON password_change_requests TO service_role;
