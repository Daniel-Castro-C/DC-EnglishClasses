#!/usr/bin/env python3
"""Operator-run encrypted-volume backup; no secrets or records are written into git."""
import argparse, hashlib, json, os, subprocess, tempfile
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote, urlsplit
from datetime import datetime, timezone

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def verify(root):
    m=json.loads((root/'manifest.json').read_text())
    if m['format']!=1 or m['complete'] is not True or 'database.dump' not in m['files']:
        raise ValueError('Incomplete backup')
    for name,sha in m['files'].items():
        p=root/name
        if not p.resolve().is_relative_to(root.resolve()) or not p.is_file() or digest(p)!=sha:
            raise ValueError('Missing or corrupt backup file')
    for row in m['objects']:
        if row['file'] not in m['files']:raise ValueError('Untracked storage object')
    print(f"Verified: {len(m['files'])} files, {len(m['objects'])} storage objects.")

def backup(target):
    project=os.environ['SUPABASE_URL'].rstrip('/')
    key=os.environ['SUPABASE_SERVICE_ROLE_KEY']
    url=urlsplit(project)
    if url.scheme!='https' or not url.hostname or not url.hostname.endswith('.supabase.co'):
        raise ValueError('Expected managed Supabase HTTPS endpoint')
    for var in ('PGHOST','PGUSER','PGPASSWORD','PGDATABASE'):
        if not os.environ.get(var):raise ValueError(f'Missing {var}')
    if os.environ.get('PGSSLMODE') not in ('require','verify-ca','verify-full'):raise ValueError('Require TLS for PostgreSQL')
    target=target.resolve()
    if target.exists():raise ValueError('Target already exists; never overwrite backups')
    if not target.parent.is_dir():raise ValueError('Target parent must exist on encrypted volume')
    def request(path,body=None):
        headers={'Authorization':'Bearer '+key,'apikey':key}
        if body is not None:headers['Content-Type']='application/json'
        req=Request(project+'/storage/v1/'+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
        return urlopen(req,timeout=90)
    with tempfile.TemporaryDirectory(prefix='.portal-backup-',dir=target.parent) as tmp:
        root=Path(tmp);(root/'objects').mkdir(mode=0o700)
        started=datetime.now(timezone.utc).isoformat()
        subprocess.run(['pg_dump','--format=custom','--file',str(root/'database.dump')],check=True)
        files={'database.dump':digest(root/'database.dump')};objects=[]
        with request('bucket') as r:buckets=json.load(r)
        for bucket in buckets:
            bid=bucket['id'];pending=[''];seen=set()
            while pending:
                prefix=pending.pop()
                if prefix in seen:raise ValueError('Unexpected repeated directory')
                seen.add(prefix);offset=0
                while True:
                    with request('object/list/'+quote(bid,safe=''),{'prefix':prefix,'limit':100,'offset':offset,'sortBy':{'column':'name','order':'asc'}}) as r:rows=json.load(r)
                    for row in rows:
                        name=(prefix+'/' if prefix else '')+row['name']
                        if row.get('id') is None:pending.append(name);continue
                        rel='objects/'+hashlib.sha256((bid+'\0'+name).encode()).hexdigest()
                        if rel in files:raise ValueError('Object listing changed during backup')
                        dest=root/rel
                        with request('object/authenticated/'+quote(bid,safe='')+'/'+quote(name,safe='/')) as r,dest.open('xb') as f:
                            for chunk in iter(lambda:r.read(1024*1024),b''):f.write(chunk)
                        files[rel]=digest(dest);objects.append({'bucket':bid,'name':name,'file':rel})
                    if len(rows)<100:break
                    offset+=len(rows)
        (root/'manifest.json').write_text(json.dumps({'format':1,'complete':True,'started_at':started,'completed_at':datetime.now(timezone.utc).isoformat(),'buckets':buckets,'objects':objects,'files':files},ensure_ascii=False))
        verify(root)
        root.rename(target)
    print('Backup complete; retain the directory only on encrypted private storage.')

if __name__=='__main__':
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['backup','verify'])
    parser.add_argument('directory',type=Path)
    args=parser.parse_args()
    if args.action=='verify':verify(args.directory)
    else:backup(args.directory)
