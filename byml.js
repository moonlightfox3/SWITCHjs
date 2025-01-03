let resultBYML = null
let resultNameBYML = null
let inFileTypesBYML = ["byml"]
let outFileTypeBYML = "json"
async function decompressFileFromBYML () {
    let file = await importFile(inFileTypesBYML)
    resultBYML = decompressFromBYML(file.buf)
    resultNameBYML = file.name
}
async function downloadResultBYML () {
    await exportFile(resultBYML, resultNameBYML, outFileTypeBYML)
}
let byml_hashKeyTable = null
let byml_stringTable = null
let byml_fileStructure = null
function decompressFromBYML (data) {
    byml_hashKeyTable = null
    byml_stringTable = null
    byml_fileStructure = null

    let numMode = null
    let header = getBuf(data, 0, 16)
        let header_name = getStr(header, 0, 2)
            expectVals(header_name, ["BY", "YB"], "Invalid file", "BYML header does not start with 'BY' or 'YB'")
            if (header_name == "BY") numMode = "BE"
            else if (header_name == "YB") numMode = "LE"
        let header_version = getNum(header, 2, 2, numMode)
        let header_hashKeyTableOffset = getNum(header, 4, 4, numMode)
        let header_stringTableOffset = getNum(header, 8, 4, numMode)
        let header_rootNodeOffset = getNum(header, 12, 4, numMode)
    let src = getBuf(data, 16, data.byteLength - 16)
        byml_hashKeyTable = byml_getNode(data, header_hashKeyTableOffset, header_version, numMode, true)
        byml_stringTable = byml_getNode(data, header_stringTableOffset, header_version, numMode, true)
        let rootNode = byml_getNode(data, header_rootNodeOffset, header_version, numMode, true)
            let rootNodeType = getByte(data, header_rootNodeOffset)
            let rootNodeContainerType = {}
            if (rootNode != null) rootNodeContainerType = byml_getContainerNode(rootNodeType, header_version)
    
    byml_fileStructure = rootNodeContainerType
    if (rootNode != null) byml_traverseNodes(data, rootNode, [], header_version, numMode)
        let json = JSON.stringify(byml_fileStructure, null, 4) + "\n"
        let jsonBuf = new TextEncoder().encode(json).buffer
    return jsonBuf
}
function byml_traverseNodes (data, nodes, outArr, version, numMode) {
    let structure = []
    let out = byml_fileStructure
    for (let outPart of outArr) {
        structure.push(out)
        out = out[outPart]
    }

    for (let node of nodes) {
        let type = node.type
        let value = node.value
        let valueValue = byml_getValueNode(type, value, version)
        let containerValue = byml_getContainerNode(type, version)
        let convertValue = valueValue
        let hashKeyIndex = node.hashKeyIndex
        let hashKey = byml_hashKeyTable[hashKeyIndex]
        if (convertValue == null) convertValue = containerValue
        
        let nextOutArr = outArr
        if (hashKeyIndex == undefined) {
            out.push(containerValue)
            if (containerValue != null) nextOutArr.push(out.length - 1)
        } else {
            out[hashKey] = convertValue
            if (containerValue != null) nextOutArr.push(hashKey)
        }

        if (valueValue == null) {
            let outNodes = byml_getNode(data, value, version, numMode)
            byml_traverseNodes(data, outNodes, nextOutArr, version, numMode)
            nextOutArr.splice(nextOutArr.length - 1, 1)
        }
    }
}
function byml_getNode (data, offset, version, numMode, zeroEmpty = false) {
    if (zeroEmpty && offset == 0) return null

    let type = getByte(data, offset)
    let buf = getBuf(data, offset, data.byteLength - offset)
    if (version >= 2) {
        if (type == 0xA0) {
            let index = getNum(buf, 1, 4, numMode)
            return index
        } else if (type == 0xC0) {
            let numEntries = getNum(buf, 1, 3, numMode)
            let nodes = []
            let typesBuf = getBuf(buf, 4, numEntries)
                let types = [...new Uint8Array(typesBuf)]
            let valuesBuf = getBuf(buf, 4 + (Math.ceil(numEntries / 4) * 4), 4 * numEntries)
                for (let i = 0; i < numEntries; i++) {
                    let type = types[i]
                    let value = getNum(valuesBuf, i * 4, 4, numMode)
                    nodes.push({type, value})
                }
            return nodes
        } else if (type == 0xC1) {
            let numEntries = getNum(buf, 1, 3, numMode)
            let entries = new Array(numEntries)
            for (let i = 0; i < numEntries; i++) {
                let entry = getBuf(buf, 4 + (i * 8), 8)
                    let hashKeyIndex = getNum(entry, 0, 3, numMode)
                    let type = getByte(entry, 3)
                    let value = getNum(entry, 4, 4, numMode)
                entries[i] = {type, value, hashKeyIndex}
            }
            return entries
        } else if (type == 0xC2) {
            let numEntries = getNum(buf, 1, 3, numMode)
                let offsetsArrSize = 4 * (numEntries + 1)
            let offsetsBuf = getBuf(buf, 4, offsetsArrSize)
                let stringsStart = getNum(offsetsBuf, 0, 4, numMode)
                let stringsEnd = getNum(offsetsBuf, numEntries * 4, 4, numMode)
            let stringsBuf = getBuf(buf, stringsStart, stringsEnd - stringsStart)
                let stringsStr = getStr(stringsBuf, 0, stringsBuf.byteLength)
                let strings = stringsStr.slice(0, -1).split("\x00")
            return strings
        } else if (type == 0xD0) {
        } else if (type == 0xD1) {
            let num = getNum(buf, 1, 4, numMode)
            return num
        } else if (type == 0xD2) {
        } else if (type == 0xD3) {
        }
    }
    if (version >= 3) {
        if (type == 0xD4) {
        } else if (type == 0xD5) {
        } else if (type == 0xD6) {
        } else if (type == 0xFF) {
        }
    }
    if (version >= 4) {
        /*if (type == 0xA1) {
        }*/
    }
    if (version >= 5) {
        /*if (type == 0xA2) {
        }*/
    }
    if (version >= 7) {
        /*if (type == 0x20) {
        } *//*else if (type == 0x21) {
        }*/
    }

    expectVal(0, 1, "Error reading file", `Unknown node type: 0x${type.toString(16).toUpperCase()} (${type}). File offset: 0x${offset.toString(16).toUpperCase()} (${offset})`)
}
function byml_getContainerNode (type, version) {
    if (version >= 2) {
        if (type == 0xA0) {
            return null
        } else if (type == 0xC0) {
            return []
        } else if (type == 0xC1) {
            return {}
        } else if (type == 0xC2) {
            return null
        } else if (type == 0xD0) {
            return null
        } else if (type == 0xD1) {
            return null
        } else if (type == 0xD2) {
            return null
        } else if (type == 0xD3) {
            return null
        }
    }
    if (version >= 3) {
        if (type == 0xD4) {
            return null
        } else if (type == 0xD5) {
            return null
        } else if (type == 0xD6) {
            return null
        } else if (type == 0xFF) {
            return null
        }
    }
    if (version >= 4) {
        /*if (type == 0xA1) {
        }*/
    }
    if (version >= 5) {
        /*if (type == 0xA2) {
        }*/
    }
    if (version >= 7) {
        /*if (type == 0x20) {
        } *//*else if (type == 0x21) {
        }*/
    }
    
    expectVal(0, 1, "Error reading file", `Unknown node type: 0x${type.toString(16).toUpperCase()} (${type}). Function: Parse container node`)
}
function byml_getValueNode (type, value, version) {
    if (version >= 2) {
        if (type == 0xA0) {
            return byml_stringTable[value]
        } else if (type == 0xC0) {
            return null
        } else if (type == 0xC1) {
            return null
        } else if (type == 0xC2) {
            return null
        } else if (type == 0xD0) {
            return value
        } else if (type == 0xD1) {
            return value
        } else if (type == 0xD2) {
            return numGetFloatSingle(value)
        } else if (type == 0xD3) {
            return value
        }
    }
    if (version >= 3) {
        if (type == 0xD4) {
            // special - offset from start of file
            // int64
        } else if (type == 0xD5) {
            // special - offset from start of file
            // uint64
        } else if (type == 0xD6) {
            // special - offset from start of file
            // double (binary64)
        } else if (type == 0xFF) {
            return value
        }
    }
    if (version >= 4) {
        /*if (type == 0xA1) {
        }*/
    }
    if (version >= 5) {
        /*if (type == 0xA2) {
        }*/
    }
    if (version >= 7) {
        /*if (type == 0x20) {
        } *//*else if (type == 0x21) {
        }*/
    }
    
    expectVal(0, 1, "Error reading file", `Unknown node type: 0x${type.toString(16).toUpperCase()} (${type}). Function: Parse value node`)
}
