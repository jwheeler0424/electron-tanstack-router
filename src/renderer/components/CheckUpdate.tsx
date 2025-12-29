import { UPDATE_CODE } from "@/constants/application";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "./ui/dialog";
type UpdateInfo = {
  update: boolean;
  version: string;
  newVersion: string;
  status: number;
};

export default function CheckUpdate() {
  const [status, setStatus] = useState<number | null>(null);
  const [versionInfo, setVersionInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<Error | null>(null);
  const [downloadPercent, setDownloadPercent] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);

  const update = window.electron.update;

  update.onUpdateMsg(({ code, data }) => {
    console.log(code, data);
    setStatus(code);
    if (code === UPDATE_CODE.downloadProgress) {
      setDownloadPercent((data.transferred / data.total) * 100);
    }
    if (
      code === UPDATE_CODE.updateAvaible ||
      code === UPDATE_CODE.updateNotAvaible
    ) {
      setVersionInfo(data);
    }
  });

  update.onUpdateError((response) => {
    setUpdateError(new Error(response?.data?.message || "Unknown error"));
  });

  const init = async () => {
    setModalOpen(true);
    await checkUpdate();
  };

  const checkUpdate = async () => {
    setStatus(UPDATE_CODE.checking);
    update.checkUpdate();
    setDownloadPercent(0);
    setModalOpen(true);
  };

  const cancel = async () => {
    update.cancelUpdate();
    setModalOpen(false);
  };

  const download = () => {
    update.startDownload();
  };

  //install
  const setup = () => {
    update.quitAndInstall();
  };

  const checking = status === UPDATE_CODE.checking;
  const updateAvailable = status === UPDATE_CODE.updateAvaible;

  return (
    <Dialog open={modalOpen}>
      <DialogTrigger asChild>
        <Button disabled={checking} onClick={init}>
          {checking ? "Checking..." : "Check for Updates"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <div className="mb-4">
          {updateError ? (
            <div>
              <p className="text-error mb-2">
                Error downloading the latest version.
              </p>
              <p className="text-error text-sm">{updateError.message}</p>
            </div>
          ) : updateAvailable ? (
            <div>
              <div className="text-success mb-2">
                The latest version is: v{versionInfo?.newVersion}
              </div>
              <div className="text-base-content/70 text-sm mb-4">
                Current: v{versionInfo?.version} → v{versionInfo?.newVersion}
              </div>
              <div className="mb-4">
                <div className="text-sm mb-2">Update progress:</div>
                <div className="bg-base-200 rounded-full h-4 w-full overflow-hidden">
                  <div
                    className="bg-success h-full transition-all duration-300"
                    style={{ width: `${downloadPercent || 0}%` }}
                  ></div>
                </div>
                <div className="text-xs mt-2 text-base-content/70">
                  {downloadPercent ? `${downloadPercent.toFixed(1)}%` : "0%"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-base-content/50">
              No update available.
              <br />
              <pre className="text-xs mt-2 bg-base-200 p-2 rounded overflow-auto">
                {JSON.stringify(versionInfo ?? {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
      <DialogFooter>
        <div className="modal-action">
          <DialogClose asChild>
            <Button variant="outline" onClick={cancel}>
              Cancel Update
            </Button>
          </DialogClose>
          {updateAvailable && (
            <Button onClick={updateAvailable ? download : setup}>
              {downloadPercent >= 100
                ? "Install and Restart"
                : "Download Update"}
            </Button>
          )}
        </div>
      </DialogFooter>
    </Dialog>
  );
}
