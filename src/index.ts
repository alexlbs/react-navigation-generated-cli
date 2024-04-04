#!/usr/bin/env node
import program from 'commander';
import fs from 'fs';
import { exec } from 'child_process';
import { Spinner } from 'cli-spinner';
import jsyaml from 'js-yaml';
// @ts-ignore
import matchAll from 'match-all';

const START_IDENTIFIER = 'REACT_NAVIGATION_GENERATED_OUTPUT:';
const END_IDENTIFIER = 'END_REACT_NAVIGATION_GENERATED';

const START_ROUTE_TYPES_IDENTIFIER =
  '// START react-navigation-generated types\n';
const END_ROUTE_TYPES_IDENTIFIER = '// END react-navigation-generated types\n';
const DEFAULT_APP_LOGS_TIMEOUT_SECONDS = 60;
const TYPE_IMPORT_MATCHER = /import.*{\s*\w+\s+as\s+(.*)Params,?\s*}.*(?="|').*(?="|')/g;

// MARK requires import { useNavigation as _useNavigation } from '@react-navigation/native';
const USE_NAVGATION_HOOK = `
type NavigateToRouteParams<T extends keyof NavigationParams> = NavigationParams[T] | ExtraScreenParams<T>

type ExtraScreenParams<T extends keyof NavigationParams> = {
  screen: T,
  params: NavigateToRouteParams<keyof NavigationParams>
} & NavigationParams[T]

const useNavigation = () => {
  const navigation = _useNavigation<StackNavigationProp<any>>();

  const navigateTo: <T extends keyof NavigationParams>(
    route: { routeName: T },
    routeParams: NavigateToRouteParams<T>,
  ) => void = (route, routeParams) => {
    navigation.navigate(route.routeName, routeParams);
  };

  const checkDown = (map: any, toFragment: string, level: number): {
    routeName: string,
    level: number
  } | null => {
    if (typeof map !== 'object') {
      return null;
    }
  
    if (map[toFragment]) {
      return {
        routeName: map[toFragment].routeName, 
        level
      };
    }
  
    let childrenRes: any = null;
    for (const child of Object.values(map)) {
      const childRes = checkDown(child, toFragment, level + 1);
      if (childRes) {
        if (!childrenRes) {
          childrenRes = childRes;
        } else if (childrenRes.level > childRes) {
          childrenRes = childRes;
        }
      }
    }
  
    return childrenRes;
  }
  
  const checkUp = (pathFragments: Array<string>, toFragment: string, level: number, skipKey: string): any => {
    if (pathFragments.length === 0) {
      return null;
    }
  
    let currentLevelObj: any = routeMap;
    for (const name of pathFragments) {
      currentLevelObj = currentLevelObj[name];
    }
  
    if (currentLevelObj[toFragment]) {
      return {
        routeName: currentLevelObj[toFragment].routeName,
        level,
      }
    }
  
    let downRes: any = null;
    for (const [name, child] of Object.entries(currentLevelObj)) {
      if (name !== skipKey) {
        let childRes = checkDown(child, toFragment, level + 1);
        if (childRes) {
          if (!downRes) {
            downRes = childRes;
          } else if (downRes.level > childRes) {
            downRes = childRes;
          }
        }
      }
    }
  
    const upRes = checkUp(pathFragments.slice(0, pathFragments.length - 1), toFragment, level + 1, pathFragments[pathFragments.length]);
  
    if (upRes) {
      if (downRes.level < upRes.level) {
        return downRes;
      }
      return upRes;
    }
    return downRes;
  }

  function navigateRelative<T extends keyof RouteFragmentParams>
  ({
    from,
    toFragment,
    params,
    push,
    key
  }: {
    from: string, 
    toFragment: T, 
    params: RouteFragmentParams[T], 
    push?: boolean,
    key?: string
  }) {
    let routeFragments;
    routeFragments = from.split('.')

    const currentLevelRouteFragments = routeFragments.slice(0, routeFragments.length - 1);
  
    // //check level
    let currentLevelObj: any = routeMap;
    for (const name of currentLevelRouteFragments) {
      currentLevelObj = currentLevelObj[name];
    }

    //checkdown
    const currentObj = currentLevelObj[routeFragments[routeFragments.length - 1]];
    const downRes = checkDown(currentObj, toFragment, 0);
  
    //checkup
    const upRes = checkUp(currentLevelRouteFragments, toFragment, 0, routeFragments[routeFragments.length - 1]);
  
    if (downRes === null && upRes === null) {
      throw new Error('Invalid Fragment');
    }
  
    let routeName;
    if (downRes) {
      if (upRes) {
        if (downRes.level < upRes.level) {
          routeName = downRes.routeName;
        } else {
          routeName = upRes.routeName;
        }
      } else {
        routeName = downRes.routeName;
      }
    } else {
      routeName = upRes.routeName;
    }

    if (push) {
      // @ts-ignore
      navigation.push(routeName, params);
    } else {
      navigation.navigate({ name: routeName, key, params });
    }
  }

  return {
    ...navigation,
    navigateTo,
    navigateRelative,
  };
};

function useRoute<R extends keyof NavigationParams>(): RouteProp<NavigationParams, R> { return (_useRoute as any)()}

export { useNavigation, useRoute };
`;

program.option('-t, --timeout <timeout>', 'logs timeout seconds');
program.option('-l, --showLogs', 'display logs');
program.option('-k, --keepOpen', 'keep expo process running');
program.parse(process.argv);

type RouteMap = {
  // routeName: string
  [name: string]: RouteMap | string;
};

const getRouteMapRouteNames = (routeMap: RouteMap, routeNames: Set<string>) => {
  for (const [key, child] of Object.entries(routeMap ?? {})) {
    if (key === 'routeName' && typeof child === 'string') {
      routeNames.add(child);
    } else if (typeof child !== 'string') {
      getRouteMapRouteNames(child, routeNames);
    }
  }
};

const writeRouteParamTypes = (
  appRouteFilePath: string,
  rootNavigators: any,
) => {
  const fileData = fs.readFileSync(appRouteFilePath, 'utf8');

  const typesStartIdentifierEndIndex =
    fileData.indexOf(START_ROUTE_TYPES_IDENTIFIER) +
    START_ROUTE_TYPES_IDENTIFIER.length;
  const typesEndIdentifierEndIndex =
    fileData.indexOf(END_ROUTE_TYPES_IDENTIFIER) +
    END_ROUTE_TYPES_IDENTIFIER.length;

  const postIdentifierText = fileData.slice(typesEndIdentifierEndIndex);

  const fragmentRouteNames = new Set<string>();
  const fragmentRoute: any = {};
  const fragmentParams: any = {};
  const routeToImport: any = {};

  const keyToImports: Array<[string, string]> = matchAll(
    fileData,
    TYPE_IMPORT_MATCHER,
  )
    .toArray()
    .map((s: string) => {
      console.log("map value", s);
      const sfrag = s.split('_');

      const fragName = sfrag[sfrag.length - 1];
      fragmentRouteNames.add(fragName);
      fragmentRoute[fragName] = sfrag.join('.');
      fragmentParams[fragName] = s;

      return [sfrag.join('.'), s];
    });
  const routeNamesWithParams = new Set(keyToImports.map((o) => o[0]));

  const allRouteNames = new Set<string>();
  getRouteMapRouteNames(rootNavigators, allRouteNames);

  const typesObjString = keyToImports.map(([key, val]) => `  '${key}': ${val}Params;`).join("\n");

//  const typesObjString = keyToImports.reduce(
//    (str, [key, val], i) =>
//      str + (i === 0 ? '\n' : '') + `  '${key}': ${val}Params;\n`,
//    '',
//  );
  const noParamsString = [...allRouteNames]
    .filter((k) => !routeNamesWithParams.has(k))
    .map(routeName => `  '${routeName}': {};`).join('\n');
    //.reduce((str, routeName) => str + `  '${routeName}': {};\n`, '');

//  const paramsString = [...fragmentRouteNames].reduce(
//    (str, key, i) => str + (i === 0 ? '\n' : '') + `  ${key} = '${key}', \n`,
//    '',
//  );

  const paramsString = [...fragmentRouteNames].map(key => `  ${key} = '${key}'`).join(",\n");


  const fragString = [...fragmentRouteNames]
    .filter((k) => !routeNamesWithParams.has(k))
    .reduce(
      (str, routeName) =>
        str +
        `  '${routeName}': ${`${fragmentParams[routeName]}Params` ?? '{}'};\n`,
      '',
    );
  // const routeFragmentEnumString = [...allRouteNames]
  //   .filter(k => fragmentRouteNames())

  const editedFileData =
    fileData.slice(0, typesStartIdentifierEndIndex) +
    `export type NavigationParams = {${
      typesObjString + '\n' + noParamsString
    }};` +
    '\n' +
    `export enum RouteFragments {
      ${paramsString}
    };` +
    '\n' +
    `export type RouteFragmentParams = {
      ${fragString}
    }` +
    '\n' +
    USE_NAVGATION_HOOK +
    '\n' +
    END_ROUTE_TYPES_IDENTIFIER +
    postIdentifierText;

  fs.writeFileSync(appRouteFilePath, editedFileData);
};

setInterval(() => {}, 1 << 30);

try {
  const configContent = fs.readFileSync(
    process.cwd() + '/rn-gen-config.yml',
    'utf8',
  );
  const { navigationroot, outputpath } = jsyaml.safeLoad(configContent) as any;

  if (navigationroot && outputpath) {
    // MARK requires that an ios simulator is running
    console.log('Starting expo...');

    let firstLog = false;
    let finished = false;
    let lastDataTail = '';
    let startMarkerFound = false; 
    let collectedOutput = '';
    let prevRouteMap: string;

    const waitTimeout = setTimeout(() => {
      if (!program.keepOpen) {
        expoProcess.kill();
        console.log(
          '\nLogs timeout exceeded. No react-navigation-generated app logs found.',
        );
      }
    }, (program.timeout ?? DEFAULT_APP_LOGS_TIMEOUT_SECONDS) * 1000);

    // one call of console.log does not mean exactly one call of onExpoData callback.
    // i.e one block that we write with console.log can be split into several calls of onExpoData
    // and several console.log can be joined into one call of onExpoData..
    // all other combinations is possible (like we write data with 2 calls and read with 3 callbacks).
    // so we need to be prepared that our data STREAM can be split to block at any place (choosed by OS)
    const onExpoData = (data: any) => {
      console.log("onExpoData enter", String(data).trimEnd());
      if (!firstLog) {
        firstLog = true;
        if (!program.keepOpen) {
          console.log('Waiting for react-navigation-generated logs...');
        }
      }
      let output: string = data.toString();
      // 1) we should assume that our start\end marker can be split into to separate blocks.
      //    for example previous data ends with REACT_NAVIGATION and new block starts with _GENERATED_OUTPUT
      //    so we need to store last few bytes of previous block somewhere and use them to search for start marker
      const withTail = lastDataTail + output;
      lastDataTail = withTail.substr(-START_IDENTIFIER.length);

      if (!startMarkerFound) {
        const startIndex = withTail.indexOf(START_IDENTIFIER);
        if (startIndex >= 0) {
          startMarkerFound = true;
          collectedOutput = withTail.substr(startIndex);
          // cut JSON data from output (but print prefix, because it may contain data which does not relate to natigation)
          output = output.substring(0, startIndex - lastDataTail.length) + '[route json removed]';
        }
      } else {
        // collect all blocks between markers
        collectedOutput += output;
        output = ''; // do not print data between markers
      }

      let dataIsReady = false;
      if (startMarkerFound) {
        // search for end marker.  Again we use data which joined with previous blocks. do not use just current block - output.
        const endIndex = collectedOutput.indexOf(END_IDENTIFIER);
        if (endIndex >= 0) {
          startMarkerFound = false;
          dataIsReady = true;
          output = collectedOutput.substr(endIndex + END_IDENTIFIER.length); // we should print data after end marker
          collectedOutput = collectedOutput.substr(0, endIndex);
        }
      }

      if (dataIsReady && (!finished || program.keepOpen)) {
        finished = true;
        if (!program.keepOpen) {
          expoProcess.kill();
        }
        clearTimeout(waitTimeout);

        try {
          let routeMapString = '';
          const lines = collectedOutput.split('\n');
          for (const line of lines) {
            const ok = line.match(/REACT_NAVIGATION_GENERATED_OUTPUT:(.*)/);
            if (ok) {
              routeMapString += ok[1];
            }
          }
          const parsedMap = JSON.parse(routeMapString);
          if (routeMapString !== prevRouteMap) {
            prevRouteMap = routeMapString;

            const outputPath = process.cwd() + outputpath;
            const tsString = `const routeMap = ${routeMapString} as const;export default routeMap;`;
            fs.writeFileSync(outputPath, tsString);
            console.log("nav root", process.cwd() + navigationroot);
            writeRouteParamTypes(process.cwd() + navigationroot, parsedMap);
            console.log('\nRoute map created at ' + outputpath);  
          }
        } catch (e) {
          console.log('PARSE ERROR', e);
        }
      }
      if (program.showLogs && output) 
      {
        // use stdout.write instead of console log because we do not want to modify output data
        // console.log adds line break: so if block ends in the middle of line we do not want to break the line into two
        process.stdout.write(output);
        //console.log(output.trim());
      }
      console.log("onExpoData exit");
    };
    console.log("expo start -i --localhost", program.showLogs, process.argv);
    let expoProcess = exec('expo start -i --localhost');

    const initExpoProcess = () => {
      expoProcess.stdout?.on('data', onExpoData);
      expoProcess.on('exit', () => {
        console.log('Restarting expo...');
        expoProcess = exec('expo start -i --localhost');
        initExpoProcess();
      });
    };

    if (expoProcess) {
      initExpoProcess();
    } else {
      console.log('expo process is not started');
    }
  } else {
    console.log('Invalid configuration file');
  }
} catch (e) {
  console.log('No configuration file found');
}
