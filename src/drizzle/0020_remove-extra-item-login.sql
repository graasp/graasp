-- remove itemLogin property from extra because it is not used anymore
update item set extra = extra - 'itemLogin' where extra ? 'itemLogin';

-- newly empty extra should be replaced for folders
update item set extra='{"folder":{}}'::jsonb where type='folder' and extra = '{}';

-- empty extra from invalid recycle bin because it is not used anymore
delete from item where "type"='recycleBin'
