import {
  TYPE_TRIGGER,
  TYPE_ACTIVITY,
  TYPE_UNKNOWN,
  // SCHEMA_FILE_NAME_TRIGGER,
  // SCHEMA_FILE_NAME_ACTIVITY
  // DEFAULT_SCHEMA_ROOT_FOLDER_NAME
} from '../../common/constants';
import { activitiesDBService, triggersDBService } from '../../config/app-config';
import _ from 'lodash';
import url from 'url';
import https from 'https';
import http from 'http';
import { BaseRegistered } from '../../modules/base-registered';

// TODO support more git format
//  for the moment
//    https://github.com/:username/:projectname.git
//    https://github.com/:username/:projectname
const GITHUB_URL_PATTERN = /^(?:https\:\/\/)?github\.com\/(?:([\w\-]+)\/)(?:([\w\-]+)(?:\.git)?)$/.source;
const GITHUB_URL_SUBFOLDER_PATTERN = /^(?:https\:\/\/)?github\.com\/(?:([\w\-]+)\/)(?:([\w\-]+))\/(?:([\w\-/]+))$/.source;

// TODO
// update this information. the `somefile.json` and `aFloder` are only for testing.
// should use the imported ones from constants.
const SCHEMA_FILE_NAME_TRIGGER = 'somefile.json';
const SCHEMA_FILE_NAME_ACTIVITY = 'somefile.json';
const DEFAULT_SCHEMA_ROOT_FOLDER_NAME = 'aFolder';

/*
 * Utility functions to be extracted to utility module.
 * TODO
 */

function isGitHubURL( url ) {
  let simplePattern = new RegExp( GITHUB_URL_PATTERN );
  let subfolderPattern = new RegExp( GITHUB_URL_SUBFOLDER_PATTERN );
  return simplePattern.test( url ) || subfolderPattern.test( url );
}

function parseGitHubURL( url ) {
  let simplePattern = new RegExp( GITHUB_URL_PATTERN );
  let subfolderPattern = new RegExp( GITHUB_URL_SUBFOLDER_PATTERN );
  let result = null;

  let parsed = url.match( simplePattern );

  if ( parsed ) {
    result = {
      url : url,
      username : parsed[ 1 ],
      repoName : parsed[ 2 ]
    }
  } else {
    parsed = url.match( subfolderPattern );

    if ( parsed ) {
      result = {
        url : url,
        username : parsed[ 1 ],
        repoName : parsed[ 2 ],
        extraPath : parsed[ 3 ]
      }
    }
  }

  return result;
}

/**
 * Remote Installer class
 */
export class RemoteInstaller {

  constructor( type ) {
    this.type = type || TYPE_UNKNOWN;
  }

  install( sourceURLs ) {
    return new Promise( ( resolve, reject )=> {

      // parse the URL
      //  1. from GitHub
      //  2. from generic web server
      let parsedURLs = _.reduce( sourceURLs, ( result, url, idx )=> {
        if ( isGitHubURL( url ) ) {
          result.github.push( url );
        } else {
          result.default.push( url );
        }

        return result;
      }, { github : [], default : [] } );

      let result = {
        github : null,
        default : null
      };

      this.installFromGitHub( parsedURLs.github )
        .then( ( githubResult )=> {
          result.github = githubResult;

          return this.defaultInstall( parsedURLs.default );
        } )
        .then( ( defaultResult )=> {
          result.default = defaultResult;

          return result;
        } )
        .then( resolve )
        .catch( reject );
    } );
  }

  installFromGitHub( sourceURLs ) {
    return new Promise( ( resolve, reject )=> {
      console.log( '------- ------- -------' );
      console.log( 'Install from GitHub' );
      console.log( sourceURLs );

      let installPromise = null;

      switch ( this.type ) {
        case TYPE_ACTIVITY:
          installPromise = installActivityFromGitHub( sourceURLs );
          break;
        case TYPE_TRIGGER:
          installPromise = installTriggerFromGitHub( sourceURLs );
          break;
        default:
          throw new Error( 'Unknown Type' );
          break;
      }

      installPromise.then( ( result )=> {
        console.log( 'Installed' );
        console.log( '------- ------- -------' );
        return result;
      } )
        .then( resolve )
        .catch( reject );
    } );
  }

  // TODO
  defaultInstall( sourceURLs ) {
    return new Promise( ( resolve, reject )=> {
      console.log( '------- ------- -------' );
      console.log( 'Default installation [TODO]' );
      console.log( sourceURLs );
      resolve( sourceURLs );
      console.log( '------- ------- -------' );
    } );
  }
}

// ------- ------- -------
// utility functions

// install item from GitHub
function installFromGitHub(sourceURLs, schemaFileName, dbService) {

  // for each given source URLs, retrieve the package.json and schema.json information
  return Promise.all( _.map( sourceURLs, ( sourceURL ) => {
    let githubInfo = parseGitHubURL( sourceURL );

    return Promise.all(
      [ getPackageJSONFromGitHub( githubInfo ), getSchemaJSONFromGitHub( githubInfo, schemaFileName ) ] )
      .then( ( results ) => {
        return {
          path : constructGitHubPath( githubInfo ),
          package : results[ 0 ],
          schema : results[ 1 ]
        }
      } );
  } ) )

  // process raw items
    .then( rawItems => _.map( rawItems, rawItem => processItemFromGitHub( rawItem ) ) )

    // filter null items
    .then( items => _.filter( items, item => !_.isNull( item ) ) )

    // save items to db
    .then( items => BaseRegistered.saveItems( dbService, items ) )

    // finally return ture once finished.
    .then( result => true );
}

// shorthand function to install triggers from GitHub
function installTriggerFromGitHub( sourceURLs ) {

  return installFromGitHub(sourceURLs, SCHEMA_FILE_NAME_TRIGGER, triggersDBService);
}

// shorthand function to install activities from GitHub
function installActivityFromGitHub( sourceURLs ) {

  return installFromGitHub(sourceURLs, SCHEMA_FILE_NAME_ACTIVITY, activitiesDBService);
}

/**
 * Construct GitHub file URI using the download URL format.
 *
 * https://raw.githubusercontent.com/:username/:repoName/[:branchName | :commitHash]/:filename
 *
 * @param githubInfo {Object} `username`, `repoName`, `branchName`, `commitHash`
 * @param fileName {String} Name of the file.
 * @returns {string} The file URI to retrieve the raw data of the file.
 */
function constructGitHubFileURI( githubInfo, fileName ) {
  let commitish = githubInfo.commitHash || githubInfo.branchName || 'master';
  let extraPath = githubInfo.extraPath ? `/${ githubInfo.extraPath }` : '';

  return `https://raw.githubusercontent.com/${ githubInfo.username }/${ githubInfo.repoName }/${ commitish }${ extraPath }/${ fileName }`;
}

function constructGitHubPath( githubInfo ) {
  let extraPath = githubInfo.extraPath ? `/${ githubInfo.extraPath }` : '';
  return `github.com/${ githubInfo.username }/${ githubInfo.repoName }${ extraPath }`;
}

// retrieve file data
function getRemoteFile( fileURI ) {
  return new Promise( ( resolve, reject ) => {
    let urlInfo = url.parse( fileURI );

    let reqSender = urlInfo.protocol === 'https:' ? https.request : http.request;

    let fileReq = reqSender( _.assign( urlInfo, {
      headers : {
        'Accept' : 'application/json',
        'Accept-Charset' : 'utf-8'
      }
    } ), ( fileRes )=> {
      let body = '';

      fileRes.setEncoding( 'utf8' );

      fileRes.on( 'data', ( chunk ) => {
        body += chunk;
      } );

      fileRes.on( 'end', () => {
        if ( fileRes.statusCode !== 200 ) {
          reject( {
            body : body,
            res : fileRes
          } );
        } else {
          resolve( body );
        }
      } );

      fileRes.on( 'error', reject );
    } );

    fileReq.on( 'error', reject );
    fileReq.end();
  } );
}

// get JSOM from remote
function getRemoteJSON( fileURI ) {
  return getRemoteFile( fileURI )
    .then( ( fileContent )=> {
      let fileJSON;
      try {
        fileJSON = JSON.parse( fileContent );
      } catch ( e ) {
        console.warn( `File parse error: ${fileURI}` );
        console.warn( e );
        // fallback to empty JSON when on parse file error.
        fileJSON = {};
      }

      return fileJSON;
    } )
    .catch( ( err )=> {
      if ( _.get( err, 'res.statusCode' ) === 404 ) {
        // cannot find the file
        return null;
      } else {
        throw err;
      }
    } );
}

// shorthand funtion to get `package.json`
function getPackageJSONFromGitHub( githubInfo ) {
  // construct the URI of package.json
  let fileURI = constructGitHubFileURI( githubInfo, `${DEFAULT_SCHEMA_ROOT_FOLDER_NAME}/package.json` );

  // get the remote JSON.
  return getRemoteJSON( fileURI );
}

// shorthand function to get the schema.json
function getSchemaJSONFromGitHub( githubInfo, schemaFileName ) {
  // construct the URI of the schema file
  let fileURI = constructGitHubFileURI( githubInfo, `${DEFAULT_SCHEMA_ROOT_FOLDER_NAME}/${schemaFileName}` );

  // get the remote JSON.
  return getRemoteJSON( fileURI );
}

function processItemFromGitHub( rawItemInfo ) {
  let itemInfo = null;

  if ( rawItemInfo.path && rawItemInfo.package && rawItemInfo.schema ) {
    let p = rawItemInfo.package;
    let s = rawItemInfo.schema;

    // merge the schema and package information together
    // so that the name/version/description information can be overridden.
    let m = _.assign( {}, p, s );

    itemInfo = BaseRegistered.constructItem( {
      'id' : BaseRegistered.generateID( m.name, m.version ),
      'where' : rawItemInfo.path,
      'name' : m.name,
      'version' : m.version,
      'description' : m.description,
      'keywords' : m.keywords || [],
      'schema' : s
    } );
  }

  return itemInfo;
}

// ------- ------- -------
// debugging inspector utility
function __insp( obj ) {
  'use strict';
  console.log( require( 'util' )
    .inspect( obj, { depth : 7, colors : true } ) );
}
