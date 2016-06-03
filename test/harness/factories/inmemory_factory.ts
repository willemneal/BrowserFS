import InMemoryFileSystem from '../../../src/backend/InMemory';
import {FileSystem} from '../../../src/core/file_system';
import BackendFactory from '../BackendFactory';

export default function InMemoryFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (InMemoryFileSystem.isAvailable()) {
    cb('InMemory', [new InMemoryFileSystem()]);
  } else {
    cb('InMemory', []);
  }
}

var _: BackendFactory = InMemoryFSFactory;
