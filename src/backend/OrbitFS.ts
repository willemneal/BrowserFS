import PreloadFile from '../generic/preload_file';
import {BaseFileSystem, FileSystem, BFSOneArgCallback, BFSCallback, FileSystemOptions} from '../core/file_system';
import {ApiError} from '../core/api_error';
import {FileFlag} from '../core/file_flag';
import {default as Stats, FileType} from '../core/node_fs_stats';
import {File as IFile} from '../core/file';
import {wrapSync} from 'async';
import {buffer2ArrayBuffer} from '../core/util';

import {OrbitFS as orbitfs}  from '../generic/orbitfs';
// import * as Orbitdb from "orbit-db";
import * as IPFS from 'ipfs';

/**
 * Converts the given DOMError into an appropriate ApiError.
 * @url https://developer.mozilla.org/en-US/docs/Web/API/DOMError
 * @hidden
 */

// A note about getFile and getDirectory options:
// These methods are called at numerous places in this file, and are passed
// some combination of these two options:
//   - create: If true, the entry will be created if it doesn't exist.
//             If false, an error will be thrown if it doesn't exist.
//   - exclusive: If true, only create the entry if it doesn't already exist,
//                and throw an error if it does.

export class OrbitFSFile extends PreloadFile<OrbitFS> implements IFile {
  private _entry: FileEntry;

  constructor(fs: OrbitFS, entry: FileEntry, path: string, flag: FileFlag, stat: Stats, contents?: Buffer) {
    super(fs, path, flag, stat, contents);
    this._entry = entry;
  }

  public sync(cb: BFSOneArgCallback): void {
    if (!this.isDirty()) {
      return cb();
    }

    this._entry.createWriter((writer) => {
      const buffer = this.getBuffer();
      const blob = new Blob([buffer2ArrayBuffer(buffer) as ArrayBuffer]);
      const length = blob.size;
      writer.onwriteend = (err?: any) => {
        writer.onwriteend = <any> null;
        writer.onerror = <any> null;
        writer.truncate(length);
        this.resetDirty();
        cb();
      };
      writer.onerror = (err: any) => {
        cb(err);
      };
      writer.write(blob);
    });
  }

  public close(cb: BFSOneArgCallback): void {
    this.sync(cb);
  }
}

export interface OrbitFSOptions {
  ipfs?: IPFS;
  address?: string;
  permissions?: string[];
}

/**
 * A read-write filesystem backed by the OrbitDB and ipfs-mfs.
 *
 *
 *
 */
export default class OrbitFS extends BaseFileSystem implements FileSystem {
  public static readonly Name = "OrbitFS";

  public static readonly Options: FileSystemOptions = {
    ipfs: {
      type: "object",
      optional: true,
      description: "The IPFS instance needed by OrbitDB and ipfs-mfs"
    },
    address: {
      type: "string",
      optional: true,
      description: "address of OrbitDB"
    },
    permissions:{
      type: "string[]",
      optional: true,
      description: "List of public keys allowed to write"
    }

  };

  /**
   * Creates an OrbitFS instance with the given options.
   */
  public static Create(opts: OrbitFSOptions, cb: BFSCallback<OrbitFS>): void {
    const fs = new OrbitFS(opts);
    fs._allocate((e) => e ? cb(e) : cb(null, fs));
  }

  public _fs: orbitfs;
  private address: string;
  private permissions: string[];
  /**
   * @param ipfs Ipfs instance
   * @param address Address of underlying database
   * @param permissions Array of public keys that can write
   */
  private constructor(opts: OrbitFSOptions){
    super();
    this.address = opts.address || "";
    this.permissions =  opts.permissions || ["*"];
  }

  public getName(): string {
    return OrbitFS.Name;
  }

  public isReadOnly(): boolean {
    return false;
  }

  public supportsSymlinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    return false;
  }

  /**
   * Deletes everything in the FS. Used for testing.
   * Karma clears the storage after you quit it but not between runs of the test
   * suite, and the tests expect an empty FS every time.
   */
  public empty(mainCb: BFSOneArgCallback): void {
    wrapSync(this._fs.empty)(mainCb);
  }

  public rename(oldPath: string, newPath: string, cb: BFSOneArgCallback): void {
    wrapSync(this._fs.mv)(oldPath,newPath, cb);
  }


  public stat(path: string, isLstat: boolean, cb: BFSCallback<Stats>): void {
    wrapSync(this._fs.stat)(path, (err: string,res:StatInfo)=>{
        if (err) {
          cb(ApiError.ENOENT(err))
        } else {
          switch (res.type){
            case "file": {
              cb(null, new Stats(FileType.FILE, res.size))
              break;
            }
            case "directory": {
              cb(null, new Stats(FileType.DIRECTORY,res.blocks))
              break;
            }
            default:
             cb(ApiError.ENOENT(path));
          }
        }

    });
  }

  // public open(p: string, flags: FileFlag, mode: number, cb: BFSCallback<File>): void {
  //   wrapSync(this._fs.read)(p,{}, cb);
  //
  // }

  public unlink(path: string, cb: BFSOneArgCallback): void {
    this._remove(path, cb, true);
  }

  public rmdir(path: string, cb: BFSOneArgCallback): void {
    // Check if directory is non-empty, first.
    this.readdir(path, (e, files?) => {
      if (e) {
        cb(e);
      } else if (files!.length > 0) {
        cb(ApiError.ENOTEMPTY(path));
      } else {
        this._remove(path, cb, false);
      }
    });
  }

  public mkdir(path: string, _mode: number, cb: BFSOneArgCallback): void {
    wrapSync(this._fs.mkdir)(path, cb)
  }

  /**
   * Map _readdir's list of `FileEntry`s to their names and return that.
   */
  public readdir(path: string, cb: BFSCallback<string[]>): void {
    wrapSync(this._fs.ls)(path, (err:string, res:string[])=>{
      if (err){
        cb(ApiError.ENOTDIR(err));
      }else{
        cb(null, res);
      }
    });
  }




  /**
   * Initializes fs
   */
  private _allocate(cb: BFSOneArgCallback): void {
    try {
        wrapSync(orbitfs.create)(this.address, this.permissions, (res:orbitfs) => {
          this._fs = res;
          cb();
        });
    }
    catch(err){
      cb(err);
    }
  }

  /**
   * Delete a file or directory from the file system
   * isFile should reflect which call was made to remove the it (`unlink` or
   * `rmdir`). If this doesn't match what's actually at `path`, an error will be
   * returned
   */
  private _remove(path: string, cb: BFSOneArgCallback, isFile: boolean): void {
      let opts = {recursive: isFile};
      this._fs.rm([path], opts).then((err)=> {
        if (err){
          cb(err)
      }
    });
  }

  static Factory(cb: (name: string, objs: FileSystem[])=>void){
         OrbitFS.CreateDefault((_err, res: OrbitFS ) =>  {
                cb(OrbitFS.Name, [res]);
             });
  }

  static CreateDefault(cb: (_err: any, res: OrbitFS) => void): any {
    const fs = new OrbitFS({});
    wrapSync(orbitfs.createDefault)((_fs: orbitfs) => {
      fs._fs = _fs;
      cb(null, fs);
    });


  }
}
