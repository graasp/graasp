-- Umami
create user umami with password 'umami';
create database umami with owner umami;
-- Backend
create user graasper with password 'graasper';
create database graasp with owner graasper;
--Etherpad
create user etherpad with password 'etherpad';
create database etherpad with owner etherpad;
-- Test database
create user test with password 'test';
create database test with owner test;

-- set timeout settings for postgres
-- should avoid transactions to hang for too long
set idle_in_transaction_session_timeout = '3600000'; -- in milliseconds, 1h
set statement_timeout = '3600000'; -- in milliseconds, 1h
