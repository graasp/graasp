-- Umami
-- postgres://umami:umami@postgres:5432/umami
create user umami with password 'umami';
create database umami with owner umami;
-- Backend
create user graasper with password 'graasper';
create database graasp with owner graasper;
--Etherpad
create user etherpad with password 'etherpad';
create database etherpad with owner etherpad;
--Etherpad
create user test with password 'test';
create database test with owner test;
