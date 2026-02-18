# Recycled Items

Items can be put in the trash, so it's possible to restore them if needed.

## Use Cases

### Admin Permission on recycled child item

For the following case:

- A > B
- A: Permission Admin
- B: Permission Admin (inherited), child of A, recycled

The user will see B in its trash.

### Admin Permission on child of recycled item

For the following case:

- A > B
- A: Permission Write, recycled
- B: Permission Admin, child of A

The user will not be able to see it's element B in their trash. This means that if someone else recycled the parent (that you don't have admin permission on) of your item, you cannot access it anymore nor remove it. This should be taken into account when computing the storage of the user.
