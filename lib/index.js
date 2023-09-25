#!/usr/bin/env node
"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var commander_1 = __importDefault(require("commander"));
var fs_1 = __importDefault(require("fs"));
var child_process_1 = require("child_process");
var js_yaml_1 = __importDefault(require("js-yaml"));
// @ts-ignore
var match_all_1 = __importDefault(require("match-all"));
var START_IDENTIFIER = 'REACT_NAVIGATION_GENERATED_OUTPUT:';
var END_IDENTIFIER = 'END_REACT_NAVIGATION_GENERATED';
var START_ROUTE_TYPES_IDENTIFIER = '// START react-navigation-generated types\n';
var END_ROUTE_TYPES_IDENTIFIER = '// END react-navigation-generated types\n';
var DEFAULT_APP_LOGS_TIMEOUT_SECONDS = 60;
var TYPE_IMPORT_MATCHER = /import.*{\s*\w+\s+as\s+(.*)Params,?\s*}.*(?="|').*(?="|')/g;
// MARK requires import { useNavigation as _useNavigation } from '@react-navigation/native';
var USE_NAVGATION_HOOK = "\ntype NavigateToRouteParams<T extends keyof NavigationParams> = NavigationParams[T] | ExtraScreenParams<T>\n\ntype ExtraScreenParams<T extends keyof NavigationParams> = {\n  screen: T,\n  params: NavigateToRouteParams<keyof NavigationParams>\n} & NavigationParams[T]\n\nconst useNavigation = () => {\n  const navigation = _useNavigation<StackNavigationProp<any>>();\n\n  const navigateTo: <T extends keyof NavigationParams>(\n    route: { routeName: T },\n    routeParams: NavigateToRouteParams<T>,\n  ) => void = (route, routeParams) => {\n    navigation.navigate(route.routeName, routeParams);\n  };\n\n  const checkDown = (map: any, toFragment: string, level: number): {\n    routeName: string,\n    level: number\n  } | null => {\n    if (typeof map !== 'object') {\n      return null;\n    }\n  \n    if (map[toFragment]) {\n      return {\n        routeName: map[toFragment].routeName, \n        level\n      };\n    }\n  \n    let childrenRes: any = null;\n    for (const child of Object.values(map)) {\n      const childRes = checkDown(child, toFragment, level + 1);\n      if (childRes) {\n        if (!childrenRes) {\n          childrenRes = childRes;\n        } else if (childrenRes.level > childRes) {\n          childrenRes = childRes;\n        }\n      }\n    }\n  \n    return childrenRes;\n  }\n  \n  const checkUp = (pathFragments: Array<string>, toFragment: string, level: number, skipKey: string): any => {\n    if (pathFragments.length === 0) {\n      return null;\n    }\n  \n    let currentLevelObj: any = routeMap;\n    for (const name of pathFragments) {\n      currentLevelObj = currentLevelObj[name];\n    }\n  \n    if (currentLevelObj[toFragment]) {\n      return {\n        routeName: currentLevelObj[toFragment].routeName,\n        level,\n      }\n    }\n  \n    let downRes: any = null;\n    for (const [name, child] of Object.entries(currentLevelObj)) {\n      if (name !== skipKey) {\n        let childRes = checkDown(child, toFragment, level + 1);\n        if (childRes) {\n          if (!downRes) {\n            downRes = childRes;\n          } else if (downRes.level > childRes) {\n            downRes = childRes;\n          }\n        }\n      }\n    }\n  \n    const upRes = checkUp(pathFragments.slice(0, pathFragments.length - 1), toFragment, level + 1, pathFragments[pathFragments.length]);\n  \n    if (upRes) {\n      if (downRes.level < upRes.level) {\n        return downRes;\n      }\n      return upRes;\n    }\n    return downRes;\n  }\n\n  function navigateRelative<T extends keyof RouteFragmentParams>\n  ({\n    from,\n    toFragment,\n    params,\n    push,\n    key\n  }: {\n    from: string, \n    toFragment: T, \n    params: RouteFragmentParams[T], \n    push?: boolean,\n    key?: string\n  }) {\n    let routeFragments;\n    routeFragments = from.split('.')\n\n    const currentLevelRouteFragments = routeFragments.slice(0, routeFragments.length - 1);\n  \n    // //check level\n    let currentLevelObj: any = routeMap;\n    for (const name of currentLevelRouteFragments) {\n      currentLevelObj = currentLevelObj[name];\n    }\n\n    //checkdown\n    const currentObj = currentLevelObj[routeFragments[routeFragments.length - 1]];\n    const downRes = checkDown(currentObj, toFragment, 0);\n  \n    //checkup\n    const upRes = checkUp(currentLevelRouteFragments, toFragment, 0, routeFragments[routeFragments.length - 1]);\n  \n    if (downRes === null && upRes === null) {\n      throw new Error('Invalid Fragment');\n    }\n  \n    let routeName;\n    if (downRes) {\n      if (upRes) {\n        if (downRes.level < upRes.level) {\n          routeName = downRes.routeName;\n        } else {\n          routeName = upRes.routeName;\n        }\n      } else {\n        routeName = downRes.routeName;\n      }\n    } else {\n      routeName = upRes.routeName;\n    }\n\n    if (push) {\n      // @ts-ignore\n      navigation.push(routeName, params);\n    } else {\n      navigation.navigate({ name: routeName, key, params });\n    }\n  }\n\n  return {\n    ...navigation,\n    navigateTo,\n    navigateRelative,\n  };\n};\n\nfunction useRoute<R extends keyof NavigationParams>(): RouteProp<NavigationParams, R> { return (_useRoute as any)()}\n\nexport { useNavigation, useRoute };\n";
commander_1.default.option('-t, --timeout <timeout>', 'logs timeout seconds');
commander_1.default.option('-l, --showLogs', 'display logs');
commander_1.default.option('-k, --keepOpen', 'keep expo process running');
console.log("args", process.argv);
commander_1.default.parse(process.argv);
console.log("program", commander_1.default);
var getRouteMapRouteNames = function (routeMap, routeNames) {
    var e_1, _a;
    try {
        for (var _b = __values(Object.entries(routeMap !== null && routeMap !== void 0 ? routeMap : {})), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), key = _d[0], child = _d[1];
            if (key === 'routeName' && typeof child === 'string') {
                routeNames.add(child);
            }
            else if (typeof child !== 'string') {
                getRouteMapRouteNames(child, routeNames);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
};
var writeRouteParamTypes = function (appRouteFilePath, rootNavigators) {
    var fileData = fs_1.default.readFileSync(appRouteFilePath, 'utf8');
    var typesStartIdentifierEndIndex = fileData.indexOf(START_ROUTE_TYPES_IDENTIFIER) +
        START_ROUTE_TYPES_IDENTIFIER.length;
    var typesEndIdentifierEndIndex = fileData.indexOf(END_ROUTE_TYPES_IDENTIFIER) +
        END_ROUTE_TYPES_IDENTIFIER.length;
    var postIdentifierText = fileData.slice(typesEndIdentifierEndIndex);
    var fragmentRouteNames = new Set();
    var fragmentRoute = {};
    var fragmentParams = {};
    var routeToImport = {};
    var keyToImports = match_all_1.default(fileData, TYPE_IMPORT_MATCHER)
        .toArray()
        .map(function (s) {
        console.log("map value", s);
        var sfrag = s.split('_');
        var fragName = sfrag[sfrag.length - 1];
        fragmentRouteNames.add(fragName);
        fragmentRoute[fragName] = sfrag.join('.');
        fragmentParams[fragName] = s;
        return [sfrag.join('.'), s];
    });
    var routeNamesWithParams = new Set(keyToImports.map(function (o) { return o[0]; }));
    var allRouteNames = new Set();
    getRouteMapRouteNames(rootNavigators, allRouteNames);
    var typesObjString = keyToImports.reduce(function (str, _a, i) {
        var _b = __read(_a, 2), key = _b[0], val = _b[1];
        return str + (i === 0 ? '\n' : '') + ("  '" + key + "': " + val + "Params;\n");
    }, '');
    var noParamsString = __spread(allRouteNames).filter(function (k) { return !routeNamesWithParams.has(k); })
        .reduce(function (str, routeName) { return str + ("  '" + routeName + "': {};\n"); }, '');
    var paramsString = __spread(fragmentRouteNames).reduce(function (str, key, i) { return str + (i === 0 ? '\n' : '') + ("  " + key + " = '" + key + "', \n"); }, '');
    var fragString = __spread(fragmentRouteNames).filter(function (k) { return !routeNamesWithParams.has(k); })
        .reduce(function (str, routeName) {
        var _a;
        return str +
            ("  '" + routeName + "': " + ((_a = fragmentParams[routeName] + "Params") !== null && _a !== void 0 ? _a : '{}') + ";\n");
    }, '');
    // const routeFragmentEnumString = [...allRouteNames]
    //   .filter(k => fragmentRouteNames())
    var editedFileData = fileData.slice(0, typesStartIdentifierEndIndex) +
        ("export type NavigationParams = {" + (typesObjString + '\n' + noParamsString) + "};") +
        '\n' +
        ("export enum RouteFragments {\n      " + paramsString + "\n    };") +
        '\n' +
        ("export type RouteFragmentParams = {\n      " + fragString + "\n    }") +
        '\n' +
        USE_NAVGATION_HOOK +
        '\n' +
        END_ROUTE_TYPES_IDENTIFIER +
        postIdentifierText;
    fs_1.default.writeFileSync(appRouteFilePath, editedFileData);
};
setInterval(function () { }, 1 << 30);
try {
    var configContent = fs_1.default.readFileSync(process.cwd() + '/rn-gen-config.yml', 'utf8');
    var _b = js_yaml_1.default.safeLoad(configContent), navigationroot_1 = _b.navigationroot, outputpath_1 = _b.outputpath;
    if (navigationroot_1 && outputpath_1) {
        // MARK requires that an ios simulator is running
        console.log('Starting expo...');
        var firstLog_1 = false;
        var finished_1 = false;
        var lastDataTail_1 = '';
        var startMarkerFound_1 = false;
        var collectedOutput_1 = '';
        var prevRouteMap_1;
        var waitTimeout_1 = setTimeout(function () {
            if (!commander_1.default.keepOpen) {
                expoProcess_1.kill();
                console.log('\nLogs timeout exceeded. No react-navigation-generated app logs found.');
            }
        }, ((_a = commander_1.default.timeout) !== null && _a !== void 0 ? _a : DEFAULT_APP_LOGS_TIMEOUT_SECONDS) * 1000);
        // one call of console.log does not mean exactly one call of onExpoData callback.
        // i.e one block that we write with console.log can be split into several calls of onExpoData
        // and several console.log can be joined into one call of onExpoData..
        // all other combinations is possible (like we write data with 2 calls and read with 3 callbacks).
        // so we need to be prepared that our data STREAM can be split to block at any place (choosed by OS)
        var onExpoData_1 = function (data) {
            var e_2, _a;
            if (!firstLog_1) {
                firstLog_1 = true;
                if (!commander_1.default.keepOpen) {
                    console.log('Waiting for react-navigation-generated logs...');
                }
            }
            var output = data.toString();
            console.log("onExpoData", output, startMarkerFound_1);
            // 1) we should assume that our start\end marker can be split into to separate blocks.
            //    for example previous data ends with REACT_NAVIGATION and new block starts with _GENERATED_OUTPUT
            //    so we need to store last few bytes of previous block somewhere and use them to search for start marker
            var withTail = lastDataTail_1 + output;
            lastDataTail_1 = withTail.substr(-START_IDENTIFIER.length);
            if (!startMarkerFound_1) {
                var startIndex = withTail.indexOf(START_IDENTIFIER);
                console.log("startIndex = ", startIndex);
                if (startIndex >= 0) {
                    startMarkerFound_1 = true;
                    collectedOutput_1 = withTail.substr(startIndex);
                    // cut JSON data from output (but print prefix, because it may contain data which does not relate to natigation)
                    output = output.substring(0, startIndex - lastDataTail_1.length) + '[route json removed]';
                }
            }
            else {
                // collect all blocks between markers
                collectedOutput_1 += output;
                output = ''; // do not print data between markers
            }
            var dataIsReady = false;
            if (startMarkerFound_1) {
                // search for end marker.  Again we use data which joined with previous blocks. do not use just current block - output.
                var endIndex = collectedOutput_1.indexOf(END_IDENTIFIER);
                if (endIndex >= 0) {
                    startMarkerFound_1 = false;
                    dataIsReady = true;
                    output = collectedOutput_1.substr(endIndex + END_IDENTIFIER.length); // we should print data after end marker
                    collectedOutput_1 = collectedOutput_1.substr(0, endIndex);
                }
            }
            if (dataIsReady && (!finished_1 || commander_1.default.keepOpen)) {
                finished_1 = true;
                if (!commander_1.default.keepOpen) {
                    expoProcess_1.kill();
                }
                clearTimeout(waitTimeout_1);
                try {
                    var routeMapString = '';
                    var lines = collectedOutput_1.split('\n');
                    try {
                        for (var lines_1 = __values(lines), lines_1_1 = lines_1.next(); !lines_1_1.done; lines_1_1 = lines_1.next()) {
                            var line = lines_1_1.value;
                            var ok = line.match(/REACT_NAVIGATION_GENERATED_OUTPUT:(.*)/);
                            if (ok) {
                                routeMapString += ok[1];
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (lines_1_1 && !lines_1_1.done && (_a = lines_1.return)) _a.call(lines_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    console.log("beforeParse", routeMapString);
                    var parsedMap = JSON.parse(routeMapString);
                    if (routeMapString !== prevRouteMap_1) {
                        prevRouteMap_1 = routeMapString;
                        var outputPath = process.cwd() + outputpath_1;
                        var tsString = "const routeMap = " + routeMapString + " as const;export default routeMap;";
                        fs_1.default.writeFileSync(outputPath, tsString);
                        console.log("nav root", process.cwd() + navigationroot_1);
                        writeRouteParamTypes(process.cwd() + navigationroot_1, parsedMap);
                        console.log('\nRoute map created at ' + outputpath_1);
                    }
                }
                catch (e) {
                    console.log('PARSE ERROR');
                }
            }
            console.log("program.showLogs", commander_1.default.showLogs);
            if (commander_1.default.showLogs && output) {
                // use stdout.write instead of console log because we do not want to modify output data
                // console.log adds line break: so if block ends in the middle of line we do not want to break the line into two
                process.stdout.write(output);
                //console.log(output.trim());
            }
        };
        var expoProcess_1 = child_process_1.exec('expo start -i');
        var initExpoProcess_1 = function () {
            var _a;
            (_a = expoProcess_1.stdout) === null || _a === void 0 ? void 0 : _a.on('data', onExpoData_1);
            expoProcess_1.on('exit', function () {
                console.log('Restarting expo...');
                expoProcess_1 = child_process_1.exec('expo start -i');
                initExpoProcess_1();
            });
        };
        if (expoProcess_1) {
            initExpoProcess_1();
        }
        else {
            console.log('expo process is not started');
        }
    }
    else {
        console.log('Invalid configuration file');
    }
}
catch (e) {
    console.log('No configuration file found');
}
