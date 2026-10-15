import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function database(filename=':memory:') {
  const db=new DatabaseSync(filename);
  db.exec(readFileSync(new URL('../migrations/0001_scores.sql',import.meta.url),'utf8'));
  const adapter={
    raw:db,
    prepare(sql) {
      function statement(values=[]) {
        return {
          bind:(...args)=>statement(args),
          first:async()=>db.prepare(sql).get(...values)||null,
          all:async()=>({success:true,results:db.prepare(sql).all(...values)}),
          run:async()=>({success:true,meta:db.prepare(sql).run(...values)})
        };
      }
      return statement();
    },
    close:()=>db.close()
  };
  return adapter;
}
