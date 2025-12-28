import { Session } from "electron";
import path from "path";

export const installExtensions = async (session: Session) => {
  const extensions = [REACT_DEVELOPER_TOOLS];

  try {
    await Promise.all(
      extensions.map((extensionPath) =>
        session.extensions.loadExtension(extensionPath)
      )
    );
    console.log("Extensions loaded.");
  } catch (err) {
    console.error("An error occurred while loading React DevTools:", err);
  }
};

const REACT_DEVELOPER_TOOLS = path.join(
  process.cwd(),
  "extensions",
  "react-devtools"
);
