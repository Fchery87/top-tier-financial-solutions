-- Normalized, read-only description of the public schema (tables, columns,
-- constraints, indexes, enums). Identical query is used against any database
-- so two outputs can be diffed. Contains structure only, never row data.
select jsonb_pretty(jsonb_build_object(
  'columns', (select coalesce(jsonb_agg(x order by x->>'table', (x->>'pos')::int), '[]'::jsonb) from (
    select jsonb_build_object('table', c.relname, 'column', a.attname, 'pos', a.attnum,
      'type', format_type(a.atttypid, a.atttypmod), 'notNull', a.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid)) x
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid and c.relkind in ('r','p')
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attnum > 0 and not a.attisdropped) t),
  'constraints', (select coalesce(jsonb_agg(x order by x->>'table', x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('table', c.relname, 'name', k.conname, 'type', k.contype,
      'def', pg_get_constraintdef(k.oid)) x
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public') t),
  'indexes', (select coalesce(jsonb_agg(x order by x->>'table', x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('table', tablename, 'name', indexname, 'def', indexdef) x
    from pg_indexes where schemaname = 'public') t),
  'enums', (select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('name', t.typname,
      'labels', (select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)) x
    from pg_type t join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
    where t.typtype = 'e') t)
)) as snapshot;
