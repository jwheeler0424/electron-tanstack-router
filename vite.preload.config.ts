import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: "src/preload/preload.ts",
      fileName: "preload",
      name: "preload",
      formats: ["cjs"],
      // ...
    },
  },
});
// import { defineConfig } from 'vite';

// // https://vitejs.dev/config
// export default defineConfig({});
// import react from "@vitejs/plugin-react";
// import { readdirSync, statSync } from "node:fs";
// import path from "path";
// import { defineConfig } from "vite";
// import electron from "vite-plugin-electron";
// import pkg from "./package.json";

// // https://vitejs.dev/config/
// export default defineConfig(({ command, mode }: any) => {
//   const isProduction = command === "build";
//   return {
//     base: "./",
//     plugins: [
//       react(),
//       electron([
//         // preload
//         {
//           vite: {
//             build: {
//               rollupOptions: {
//                 input: getEntries(path.resolve(__dirname, "src/preload")),
//                 output: {
//                   format: "cjs",
//                   dir: "dist-electron/preload", // 输出目录
//                   entryFileNames: "[name].js", // 根据目录输出文件
//                   chunkFileNames: "[name].js", // 分离的 chunk 文件
//                 },
//                 external: Object.keys(pkg.dependencies),
//               },
//             },
//           },
//         },
//       ]),
//     ],
//     resolve: {
//       alias: {
//         "@/": path.resolve(__dirname, "./src"),
//         "@/common": path.resolve(__dirname, "./common"),
//       },
//     },
//   };
// });

// /**
//  * dir: main/db/index.ts
//  * return
//  * {
//  *   db/index: 'main/db/index.ts'
//  * }
//  * @param dir
//  * @returns
//  */
// const getEntries = (dir: string) => {
//   const entries: Record<string, string> = {};
//   const walk = (dirPath: string) => {
//     const files = readdirSync(dirPath);
//     files.forEach((file) => {
//       const fullPath = path.join(dirPath, file);
//       const stat = statSync(fullPath);

//       if (stat.isDirectory()) {
//         walk(fullPath);
//       } else if (file.endsWith(".ts") || file.endsWith(".js")) {
//         const relativePath = path.relative(dir, fullPath);
//         const name = relativePath.replace(/\.(ts|js)$/, "");
//         entries[name] = fullPath;
//       }
//     });
//   };
//   walk(dir);
//   return entries;
// };
