'use strict';

const MAP_DEFAULT_KEY = 'name';
const MAP_REGEX = /^\s*\{([a-zA-Z\s\*\|]*),?([a-zA-Z\s\*\|]*)\}\s*$/;
const ARRAY_REGEX = /^\s*\[([a-zA-Z\s\*\|]*)\]\s*$/;
const ATOMIC_REGEX = /^[a-zA-Z\s\*\|]*$/;

// Dirty trick to be able to test this regular browser js file with mocha
var markedFunc;
if (typeof window === 'undefined') {
  markedFunc = require('marked');
}
else {
  markedFunc = marked;
}

/**
 * @description Returns a processed OpenAPI type name to handle array of objects [OpenAPI Type]
 * @param {String} openapiType The type
 * @return {String} The true OpenAPI type name
 */
function getOpenapiTypeName(openapiType) {
  var result = null;
  // simple type like "string" or "Contact Object"
  if(openapiType.match(ATOMIC_REGEX)){
    result = openapiType;
  }
  // array [string] or [Contact Object]
  else {
    var arrayMatch = openapiType.match(ARRAY_REGEX);
    if(arrayMatch){
      result = arrayMatch[1];
    }
    else {
      // map {type} or {key, type}
      var mapMatch = openapiType.match(MAP_REGEX);
      if(mapMatch){
        if(mapMatch[2].length > 0){
          result = mapMatch[2];
        }
        else {
          result = mapMatch[1];
        }
      }
      else {
        throw 'Unexpected type format:' + openapiType;
      }
    }
  }
  return result.trim();
}

function isArray(type) {
  return type.indexOf('[') >= 0;
}

function isMap(type) {
  return type.indexOf('{') >= 0;
}

function getMapType(type) {
  // map {type} or {key, type}
  var mapMatch = type.match(MAP_REGEX);
  var mapKey;
  var mapType;
  if(mapMatch){
    if(mapMatch[2].length > 0){
      mapKey = mapMatch[1];
      mapType = mapMatch[2];
    }
    else {
      mapKey = MAP_DEFAULT_KEY;
      mapType = mapMatch[1];
    }
  }
  else {
    throw 'Unexpected type format:' + type;
  }
  return {key: mapKey.trim(), type: mapType.trim()};
}

/**
 * @description Generate anchor (to find documentation in the specification) for OpenAPI type (handle [OpenAPI Type])
 * @param {String} openapiType The type
 * @return {String} The anchor
 */
function getAnchorForType(openapiType) {
  var typeName = getOpenapiTypeName(openapiType).replace(/ /g, '');
  return typeName.charAt(0).toLowerCase() + typeName.slice(1);
}

/**
 * @description Generate documentation URL for OpenAPI type (handle [OpenAPI Type]) or anchor
 * @param {String} openapiType The type
 * @param {String} anchor The anchor
 * @param {String} specificationUrl The specification URL
 * @return {String} The documentation URL
 */
function getDocumentationUrl(openapiType, anchor, specificationUrl) {
  var documentationUrl;
  if (anchor !== undefined) {
    documentationUrl = specificationUrl + '#' + anchor;
  }
  else if (openapiType !== null) {
    documentationUrl = specificationUrl + '#' + getAnchorForType(openapiType);
  }
  return documentationUrl;
}

/**
 * @description Updates OpenAPI Specification example links (../examples) in HTML description
 * @param {String} html The html
 * @param {String} specificationUrl Specification's URL
 * @return {String} The HTML
 */
function updateOpenAPIExampleLinks(html, specificationUrl) {
  var result;
  if(specificationUrl){
    var specificationFolder = specificationUrl.substring(0,specificationUrl.lastIndexOf('/')+1);
    result = html.replace(/<a href="\.\./g, '<a href="'+specificationFolder+'..');
  }
  else {
    result = html;
  }
  return result;
}

/**
 * @description Updates OpenAPI Specification anchor links in HTML description
 * @param {String} html The html
 * @param {String} specificationUrl Specification's URL
 * @return {String} The HTML
 */
function updateOpenAPIAnchors(html, specificationUrl) {
  var result;
  if(specificationUrl){
    result = html.replace(/<a href="#/g, '<a href="'+specificationUrl+"#");
  }
  else {
    result = html;
  }
  return result;
}

/**
 * @description Adds target="_blank" to all links in html
 * @param {String} html
 * @returns {String} Modified html 
 */
function addTargetBlankToURL(html) {
  var result = html;
  result = result.replace(/<a href=/g, '<a target="_blank" href=');
  return result;
}

/**
 * @description Generates HTML for Markdown, adds target blank on links and updates local anchors with specificationUrl
 * @param {String} md The Mardown
 * @param {String} specificationUrl Specification's URL
 * @return {String} The HTML
 */
function getHTMLFromMD(md, specificationUrl) {
  var html;
  if (md !== undefined && md !== null) {
    html = markedFunc(md);
    html = updateOpenAPIAnchors(html, specificationUrl);
    html = updateOpenAPIExampleLinks(html, specificationUrl);
    html = addTargetBlankToURL(html);
  }
  else {
    html = md;
  }
  return html;
}

/**
 * @description Does an OpenAPI type allows extension
 * @param {Object} openapiTypeDefinition The OpenAPI type definition
 * @return {Boolean} Allow extension or not
 */
function allowExtension(openapiTypeDefinition) {
  var result;
  if (openapiTypeDefinition.allowExtension === undefined) {
    result = false;
  }
  else {
    result = openapiTypeDefinition.allowExtension;
  }
  return result;
}

/**
 * @description Does a property allows reference
 * @param {Object} property The property definition
 * @return {Boolean} Allow reference or not
 */
function allowReference(property) {
  var result;
  if (property.allowReference === undefined) {
    result = false;
  }
  else {
    result = property.allowReference;
  }
  return result;
}

/**
 * @description Is an OpenAPI definition a fields group (artificial group of fields within an OpenAPI type)
 * @param {Object} openapiTypeDefinition The OpenAPI type definition
 * @return {Boolean} Is a fields group or not
 */
function isFieldsGroup(openapiDocumentation, type) {
  var openapiTypeName = getOpenapiTypeName(type);
  var definition = openapiDocumentation[openapiTypeName];
  var result;
  if (definition === undefined || definition.fieldsGroup === undefined) {
    result = false;
  }
  else {
    result = definition.fieldsGroup;
  }
  return result;
}

function isOpenapiType(openapiDocumentation, type) {
  var openapiTypeName = getOpenapiTypeName(type);
  var definition = openapiDocumentation[openapiTypeName];
  var result;
  if (definition === undefined) {
    result = false;
  }
  else if (isFieldsGroup(openapiDocumentation, type)) {
    result = false;
  }
  else {
    result = true;
  }
  return result;
}

function isAtomicField(openapiDocumentation, field) {
  var result;
  if (field.type === undefined) {
    result = false;
  }
  else {
    var openapiTypeName = getOpenapiTypeName(field.type);
    var definition = openapiDocumentation[openapiTypeName];
    if (definition === undefined) {
      result = true;
    }
    else {
      result = false;
    }
  }
  return result;
}

function getFields(typeDefinition, openapiDocumentation) {
  var result = [];
  for (var i = 0; i < typeDefinition.fields.length; i++) {
    var field = typeDefinition.fields[i];
    if (isFieldsGroup(openapiDocumentation, field.type)) {
      var fieldsGroupDefinition = openapiDocumentation[field.type];
      result = result.concat(
        getFields(fieldsGroupDefinition, openapiDocumentation));
    }
    else {
      result.push(field);
    }
  }
  return result;
}

function getNewProperties(type, openapiDocumentation, specificationUrl) {
  var result = [];
  var fields = getFields(type, openapiDocumentation);
  for (var i = 0; i < fields.length; i++) {
    var property = fields[i];
    if (property.changelog && property.changelog.isNew) {
      result.push({
        name: property.name,
        description: getHTMLFromMD(property.description, specificationUrl)
      });
    }
  }
  return result;
}

function getModifiedProperties(type, openapiDocumentation, specificationUrl) {
  var result = [];
  var fields = getFields(type, openapiDocumentation);
  for (var i = 0; i < fields.length; i++) {
    var property = fields[i];
    if (property.changelog && property.changelog.isModified) {
      result.push({
        name: property.name,
        description: getHTMLFromMD(property.changelog.details, specificationUrl)
      });
    }
  }
  return result;
}

function getDeletedProperties(type, specificationUrl) {
  var result = [];
  if (type.changelog !== undefined && type.changelog.deletedProperties) {
    result = type.changelog.deletedProperties;
    for (var i = 0; i < result.length; i++) {
      if (result[i].see !== undefined) {
        result[i].documentationUrl = getDocumentationUrl(result[i].see, undefined, specificationUrl);
      }
    }
  }
  return result;
}


var mdUrls = {
  gfm: 'https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet',
  commonmark: 'http://commonmark.org/help/'
};
function getMd(field) {
  var md;
  if (field.md) {
    md = {
      syntax: field.md,
      url: mdUrls[field.md.toLowerCase()]
    };
  }
  return md;
}

function buildNodeFromOpenapiType(openapiDocumentation,
                                  openapiType,
                                  specificationUrl,
                                  parentNode,
                                  withChildren,
                                  allowReference) {
  var openapiTypeName = getOpenapiTypeName(openapiType);
  var definition = openapiDocumentation[openapiTypeName];
  var node = {
    name: definition.name,
    type: openapiTypeName,
    definition: definition,
    typeDocumentationUrl: getDocumentationUrl(
                            openapiTypeName,
                            definition.specificationAnchor,
                            specificationUrl),
    typeDescription: getHTMLFromMD(definition.description, specificationUrl),
    typeChangelog: definition.changelog,
    allowExtension: allowExtension(definition),
    isFieldsGroup: isFieldsGroup(openapiDocumentation, openapiType),
    isOpenapiType: isOpenapiType(openapiDocumentation, openapiType),
    closedChildren: []
  };

  if (!node.name) {
    node.name = node.type;
  }

  if (node.typeChangelog !== undefined &&
      node.typeChangelog.details !== undefined) {
    node.typeChangelog.details = getHTMLFromMD(node.typeChangelog.details, specificationUrl);
  }

  var newProperties = getNewProperties(definition, openapiDocumentation, specificationUrl);
  if (newProperties.length > 0) {
    if (node.typeChangelog === undefined) {
      node.typeChangelog = {newProperties: newProperties};
    }
    else {
      node.typeChangelog.newProperties = newProperties;
    }
  }

  var modifiedProperties = getModifiedProperties(definition, openapiDocumentation, specificationUrl);
  if (modifiedProperties.length > 0) {
    if (node.typeChangelog === undefined) {
      node.typeChangelog = {modifiedProperties: modifiedProperties};
    }
    else {
      node.typeChangelog.modifiedProperties = modifiedProperties;
    }
  }

  var deletedProperties = getDeletedProperties(definition, specificationUrl);
  if (deletedProperties.length > 0) {
    if (node.typeChangelog === undefined) {
      node.typeChangelog = {deletedProperties: deletedProperties};
    }
    else {
      node.typeChangelog.deletedProperties = deletedProperties;
    }
  }

  if (withChildren) {
    for (var index = 0; index < definition.fields.length; index++) {
      node.closedChildren.push(
        buildNodeFromField(
          openapiDocumentation,
          definition.fields[index],
          specificationUrl,
          node));
    }
    if (node.allowExtension) {
      var extensionNode = buildNodeFromField(
          openapiDocumentation,
          openapiDocumentation['Specification Extensions'],
          specificationUrl);
      extensionNode.isTechnical = true;
      node.closedChildren.push(extensionNode);
    }
    if (allowReference) {
      var referenceNode = buildNodeFromField(
          openapiDocumentation,
          openapiDocumentation['Reference Object'],
          specificationUrl);
      referenceNode.isTechnical = true;
      node.closedChildren.push(referenceNode);
    }
  }

  return node;
}

function buildNodeFromField(openapiDocumentation, field, specificationUrl, parentNode) {
  var node;
  if(isMap(field.type)){
    node = buildNodeFromMapField(openapiDocumentation, field, specificationUrl, parentNode);
  }
  else {
    node = buildNodeFromArrayOrObjectField(openapiDocumentation, field, specificationUrl, parentNode);
  }
  return node;
}

function buildNodeFromMapField(openapiDocumentation, field, specificationUrl, parentNode) {
  var node;
  if(isMap(field.type)){
    var mapType = getMapType(field.type);
    node = {
      name: field.name,
      type: mapType.type,
      description: getHTMLFromMD(field.description, specificationUrl),
      changelog: field.changelog,
      allowReference: false,
      isMap: true,
      isArray: false,
      isOpenapiType: isOpenapiType(openapiDocumentation, mapType.type),
      closedChildren: []
    }
    
    if (field.required) {
      node.required = true;
    }
    else {
      node.required = false;
    }

    var mapItemField = {
      name: '{'+mapType.key+'}',
      type: mapType.type,
      description: getHTMLFromMD("A `" + field.name + "` map item", specificationUrl),
      isMapItem: true,
      allowReference: allowReference(field)
    }

    node.closedChildren.push(
      buildNodeFromField(
        openapiDocumentation,
        mapItemField,
        specificationUrl,
        node));

  }
  else {
    throw 'field '+ field.name + ' is not a map';
  }
  return node;
}

function buildNodeFromArrayOrObjectField(openapiDocumentation, field, specificationUrl, parentNode) {
  var node;
  if (!isAtomicField(openapiDocumentation, field)) {
    var withChildren;
    if (field.noFollow === true) {
      withChildren = false;
    }
    else {
      withChildren = true;
    }
    node = buildNodeFromOpenapiType(
            openapiDocumentation,
            field.type,
            specificationUrl,
            parentNode,
            withChildren,
            allowReference(field));
  }
  else {
    node = {
      type: field.type
    };
  }
  node.name = field.name;
  node.description = getHTMLFromMD(field.description, specificationUrl);
  node.changelog = field.changelog;
  if (field.additionalType !== undefined) {
    node.additionalType = field.additionalType;
  }
  if (node.changelog !== undefined &&
      node.changelog.details !== undefined) {
    node.changelog.details = getHTMLFromMD(node.changelog.details, specificationUrl);
  }
  if (parentNode) {
    node.parentChangelog = parentNode.changelog;
  }
  node.isArray = isArray(field.type);
  node.allowReference = allowReference(field);
  node.values = field.values;

  var md = getMd(field);
  if (md) {
    node.md = md;
  }

  if (field.required) {
    node.required = true;
  }
  else {
    node.required = false;
  }
  return node;
}

function buildTree(openapiDocumentation, root, specificationUrl) {
  var rootNode = buildNodeFromOpenapiType(
    openapiDocumentation, root, specificationUrl, null, true);
  // var rootNode = buildNodeFromOpenapiType(
  // openapiDocumentation, 'Paths Object', specificationUrl, null, true);
  return rootNode;
}

// Dirty trick to be able to test this regular browser js file with mocha
if (typeof window === 'undefined') {
  exports.getOpenapiTypeName = getOpenapiTypeName;
  exports.getMapType = getMapType;
  exports.isMap = isMap;
  exports.isArray = isArray;
  exports.getAnchorForType = getAnchorForType;
  exports.getHTMLFromMD = getHTMLFromMD;
  exports.addTargetBlankToURL = addTargetBlankToURL;
  exports.updateOpenAPIAnchors = updateOpenAPIAnchors;
  exports.getDocumentationUrl = getDocumentationUrl;
  exports.getAnchorForType = getAnchorForType;  
  exports.updateOpenAPIExampleLinks = updateOpenAPIExampleLinks;
}
