import {FileSystem} from '../../../src/core/file_system';
import OrbitFS from '../../../src/backend/OrbitFS';
import {DefaultIpfs} from '../../../../src/ipfs';
import * as IPFS from 'ipfs';

export default function OrbitFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  (async (cb: (name: string, objs: FileSystem[])=>void) => {
    let ipfs: IPFS = await DefaultIpfs.create();
    OrbitFS.Create({ipfs:ipfs}, (_err, res ) =>  {
           cb(OrbitFS.name, [res]);
        });
     })(cb);
}
