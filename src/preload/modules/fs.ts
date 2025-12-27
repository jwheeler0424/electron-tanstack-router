import fs from "fs";
/**
 * ipcRenderer fs proxy
 */
export const fsProxy = {
  readFile: fs.readFile,
  writeFile: fs.writeFile,
  appendFile: fs.appendFile,
  mkdir: fs.mkdir,
  readdir: fs.readdir,
  stat: fs.stat,
  rmdir: fs.rmdir,
  rename: fs.rename,
  copyFile: fs.copyFile,
  access: fs.access,
  chmod: fs.chmod,
  chown: fs.chown,
  fstat: fs.fstat,
};
