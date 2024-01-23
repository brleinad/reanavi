import * as fs from "fs/promises";
import * as path from "path";
import { Command } from "@commander-js/extra-typings";

const program = new Command()
  .description("Generate React Native navigation graph from TypeScript files")
  .option("-d, --directory <path>", "Specify the project directory path");

program.parse(process.argv);
const options = program.opts();

// TODO:
// find all navigate or replace and create map of file name -> list of file names it navigates to
// find the one file that doesn't get navigated to: ie for all the file names the one that doesn't show up in any of the lists of the map
// given that root file use as the root for the graph and build the graph
// traverse the graph and print it

async function main(directoryPath: string) {
  const files = await getSourceFiles(directoryPath);
  const nav2component = await generateMapNavigationName2ComponentName(files);
  console.log(nav2component);
  const component2File = await generateMapComponentName2FileName(
    files,
    Array.from(nav2component.values()),
  );
  console.log(component2File);
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
      /.*(Stack\.Screen)\s+name="([a-zA-Z0-9_]+)"\s+component=\{([a-zA-Z0-9_]+)\}/g;
    do {
      match = regexPattern.exec(fileContent);
      if (match) {
        const navigationName = match[2];
        const componentName = match[3];
        navigationName2Component.set(navigationName, componentName);
      }
    } while (match);
  }

  return navigationName2Component;
}

// import { OnboardingNavigator } from './Onboarding/Onboarding.navigator';
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
        `export\\s+const\\s+(${componentName})\\:\\s+React\\.FC`,
        "g",
      );
      match = regexPattern.exec(fileContent);
      if (match) {
        map.set(componentName, file);
      }
    }
  }

  return map;
}

// async function get

// function getNavigations(files: string[]) {
//   files.forEach((file) => {
//     fs.readFile(file, { encoding: "utf8" }, (error, fileContent) => {
//       if (error) {
//         console.error(`Error reading file: ${error}`);
//         return;
//       }
//       const regexPattern = /(navigate|replace)\('([^']+)'\)/g;
//       // const match = fileContent.match(regexPattern);

//       let match;
//       do {
//         match = regexPattern.exec(fileContent);
//         if (match) {
//           const matchedBlob = match[2];
//           console.log(`${path.basename(file)} -> ${matchedBlob}`);
//         }
//       } while (match);
//     });
//   });
// }

type Node = {
  name: string;
  neighbour: Node[];
};
