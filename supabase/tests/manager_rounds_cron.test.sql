-- pgTAP: the Manager rounds job (#1158). pg_cron opens the mercatos due, closes the bidding rounds
-- and the mercatos whose time is over, every minute.
begin;
select plan(3);

select is((select schedule from cron.job where jobname = 'manager-rounds'), '* * * * *',
  'the Manager rounds job runs every minute');
select is((select command from cron.job where jobname = 'manager-rounds'),
  'select private.close_manager_rounds()', 'by the function that opens and closes them');
select is((select count(*)::int from cron.job where jobname = 'manager-rounds'), 1,
  'the job is scheduled once');

select * from finish();
rollback;
