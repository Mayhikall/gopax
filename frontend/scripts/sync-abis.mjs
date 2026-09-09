import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
mkdirSync(new URL('../src/lib/abi/',import.meta.url),{recursive:true});
for(const name of ['GopaxToken','RewardManager'])writeFileSync(new URL(`../src/lib/abi/${name}.json`,import.meta.url),readFileSync(new URL(`../../backend/src/abi/${name}.json`,import.meta.url)));
console.log('Frontend ABIs synced from backend compiler artifacts.');
