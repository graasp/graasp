// source: https://github.com/yjs/y-websocket-server/blob/main/src/callback.js
import { WSSharedDoc } from './utils';

const CALLBACK_OBJECTS = process.env.CALLBACK_OBJECTS
  ? JSON.parse(process.env.CALLBACK_OBJECTS)
  : {};

export const callbackHandler = (doc: WSSharedDoc) => {
  const room = doc.name;
  const dataToSend = {
    room,
    data: {},
  };
  const sharedObjectList = Object.keys(CALLBACK_OBJECTS);
  sharedObjectList.forEach((sharedObjectName) => {
    const sharedObjectType = CALLBACK_OBJECTS[sharedObjectName];
    dataToSend.data[sharedObjectName] = {
      type: sharedObjectType,
      content: getContent(sharedObjectName, sharedObjectType, doc).toJSON(),
    };
  });
};

const getContent = (objName: string, objType: string, doc: WSSharedDoc) => {
  switch (objType) {
    case 'Array':
      return doc.getArray(objName);
    case 'Map':
      return doc.getMap(objName);
    case 'Text':
      return doc.getText(objName);
    case 'XmlFragment':
      return doc.getXmlFragment(objName);
    case 'XmlElement':
      return doc.getXmlElement(objName);
    default:
      return doc.getText('');
  }
};
