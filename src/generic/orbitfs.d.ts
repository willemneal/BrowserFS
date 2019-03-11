/// <reference path="../../node_modules/dropbox/dist/dropbox.d.ts" />
import {OrbitFS}  from "orbit-fs";

declare module "orbitfs" {
  export const OrbitFS: OrbitFS;
}
