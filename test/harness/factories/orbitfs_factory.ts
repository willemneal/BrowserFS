import {FileSystem} from '../../../src/core/file_system';
import OrbitFS from '../../../src/backend/OrbitFS';

export default function OrbitFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
   OrbitFS.Factory(cb);
}
