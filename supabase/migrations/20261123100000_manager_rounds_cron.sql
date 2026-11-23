-- French Track Manager (#1158): pg_cron runs private.close_manager_rounds() every minute, as
-- manager-lineup-carry-over. It opens the mercatos whose start time is reached
-- (private.open_manager_mercatos), closes the bidding rounds whose time is over, then the mercatos
-- due. The « Manager rounds » workflow the earlier migrations mention never existed. Running the
-- migration again replaces the job instead of adding one.
select cron.unschedule(jobid) from cron.job where jobname = 'manager-rounds';
select cron.schedule('manager-rounds', '* * * * *', 'select private.close_manager_rounds()');
