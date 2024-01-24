import * as fs from "fs/promises";
import * as path from "path";
import { Command } from "@commander-js/extra-typings";

const program = new Command()
  .description("Generate React Native navigation graph from TypeScript files")
  .option("-d, --directory <path>", "Specify the project directory path");

program.parse(process.argv);
const options = program.opts();

// TODOs:
// given that root file use as the root for the graph and build the graph
// traverse the graph and print it

async function main(directoryPath: string) {
  const files = await getSourceFiles(directoryPath);
  const nav2component = await generateMapNavigationName2ComponentName(files);
  const component2File = await generateMapComponentName2FileName(
    files,
    Array.from(nav2component.values()),
  );

  const nav2file: Map<string, string> = combineMaps(
    nav2component,
    component2File,
  );

  // console.log("nav2component: ", nav2component.size);
  // console.log("component2File: ", component2File.size);
  console.log("nav2file: ", nav2file.size);

  const navs = await findAllNavigates(files, nav2file);
  console.log(navs);

  const roots = findRoots(navs);
  // console.log("ROOTS: ", roots);

  // const graphs = [];
  for (const root of roots) {
    // graphs.push(buildGraph(root));
    const path = findNavigationPath(navs, root, new Set());
    console.log("Path:", path.join(" \n  -> "));
  }
  // console.log("GRAPHS:", graphs);
}

main(options.directory || ".");

async function getSourceFiles(directoryPath: string): Promise<string[]> {
  const files = await fs.readdir(directoryPath, { recursive: true });

  return files
    .filter(
      (file): file is string =>
        typeof file === "string" &&
        (file.endsWith(".tsx") || file.endsWith(".ts")),
    )
    .map((file) => path.join(directoryPath, file));
}

async function generateMapNavigationName2ComponentName(
  files: string[],
): Promise<Map<string, string>> {
  const navigationName2Component: Map<string, string> = new Map();

  for (const file of files) {
    const fileContent = await fs.readFile(file, { encoding: "utf8" });
    let match;
    const regexPattern =
      /.*(Stack\.Screen)\s+name="([a-zA-Z0-9_]+)"\s?(options=.*)?\s+component=\{([a-zA-Z0-9_]+)\}/g;
    do {
      match = regexPattern.exec(fileContent);
      if (match) {
        const navigationName = match[2];
        const componentName = match[4];
        navigationName2Component.set(navigationName, componentName);
      }
    } while (match);
  }

  return navigationName2Component;
}

async function generateMapComponentName2FileName(
  files: string[],
  componentNames: string[],
): Promise<Map<string, string>> {
  const map: Map<string, string> = new Map();
  for (const file of files) {
    const fileContent = await fs.readFile(file, { encoding: "utf8" });
    for (const componentName of componentNames) {
      let match;
      const regexPattern = new RegExp(
        `export\\s+(const|function)\\s+(${componentName})(\\:\\s+React\\.FC)?`,
        "g",
      );
      match = regexPattern.exec(fileContent);
      if (match) {
        map.set(componentName, path.basename(file));
      }
    }
  }

  return map;
}

function combineMaps(
  a2b: Map<string, string>,
  b2c: Map<string, string>,
): Map<string, string> {
  const a2c = new Map<string, string>();

  for (const [aKey, bValue] of a2b) {
    if (b2c.has(bValue)) {
      a2c.set(aKey, b2c.get(bValue)!);
    }
  }

  return a2c;
}

async function findAllNavigates(
  files: string[],
  nav2file: Map<string, string>,
): Promise<Map<string, string[]>> {
  const file2file: Map<string, string[]> = new Map();
  for (const file of files) {
    const fileContent = await fs.readFile(file, { encoding: "utf8" });
    let match;
    const regexPattern = /(navigate|replace)\('([a-zA-Z0-9_]+)'\)/g;
    while ((match = regexPattern.exec(fileContent)) !== null) {
      const navigationToFiles = file2file.get(path.basename(file)) ?? [];
      if (match) {
        const navigationName = match[2];
        const fileNameForNavigationName = nav2file.get(navigationName);
        if (fileNameForNavigationName) {
          navigationToFiles.push(fileNameForNavigationName);
          file2file.set(path.basename(file), navigationToFiles);
        }
      }
    }
  }
  return file2file;
}

function findRoots(navs: Map<string, string[]>): string[] {
  const roots: string[] = [];
  const allLeaves: string[] = Array.from(navs.values()).reduce(
    (accumulator, currentValue) => accumulator.concat(currentValue),
    [],
  );

  for (const nav of navs.keys()) {
    if (!allLeaves.includes(nav)) {
      roots.push(nav);
    }
  }
  return roots;
}

function findNavigationPath(
  navs: Map<string, string[]>,
  start: string,
  visited: Set<string>,
  path: string[] = [],
  longestPath: string[] = [],
): string[] {
  visited.add(start);
  path.push(start);

  const neighbors = navs.get(start) || [];
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      findNavigationPath(navs, neighbor, visited, path.slice(), longestPath);
    }
  }

  if (path.length > longestPath.length) {
    longestPath.splice(0, longestPath.length, ...path);
  }
  return longestPath;
}
