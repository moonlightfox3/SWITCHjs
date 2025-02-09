let resultBYML = null
let resultNameBYML = null
let inFileTypesBYML = ["byml"]
let outFileTypeBYML = "json"
async function decompressFileFromBYML () {
    let file = await importFile(inFileTypesBYML)
    let fileBuf = new FileBuf(file.buf)
    resultBYML = decompressFromBYML(fileBuf)
    resultNameBYML = file.name
}
async function downloadResultBYML () {
    await exportFile(resultBYML, resultNameBYML, outFileTypeBYML)
}
let byml_hashKeyTable = null
let byml_stringTable = null
let byml_fileStructure = null
function decompressFromBYML (fileBuf) {
    byml_hashKeyTable = null
    byml_stringTable = null
    byml_fileStructure = null

    let numMode = null
    let header = fileBuf.buf(0x00, 0x10)
        let header_name = header.str(0x00, 0x02)
            FileBuf.expectVal(header_name, ["BY", "YB"], "BYML header does not start with 'BY' or 'YB'")
            if (header_name == "BY") numMode = Endian.BIG
            else if (header_name == "YB") numMode = Endian.LITTLE
        let header_version = header.int(0x02, IntSize.U16, {endian: numMode})
        let header_hashKeyTableOffset = header.int(0x04, IntSize.U32, {endian: numMode})
        let header_stringTableOffset = header.int(0x08, IntSize.U32, {endian: numMode})
        let header_rootNodeOffset = header.int(0x0C, IntSize.U32, {endian: numMode})
    let src = fileBuf.buf(0x10, fileBuf.data.byteLength - 0x10)
        byml_hashKeyTable = byml_parseContainerNode(fileBuf, header_hashKeyTableOffset, header_version, numMode, true)
        byml_stringTable = byml_parseContainerNode(fileBuf, header_stringTableOffset, header_version, numMode, true)
        let rootNode = byml_parseContainerNode(fileBuf, header_rootNodeOffset, header_version, numMode, true)
            let rootNodeType = fileBuf.byte(header_rootNodeOffset)
            let rootNodeContainerType = {}
            if (rootNode != null) rootNodeContainerType = byml_getContainerNodeType(rootNodeType, header_version)
    
    byml_fileStructure = rootNodeContainerType
    if (rootNode != null) byml_traverseNodes(fileBuf, rootNode, [], header_version, numMode)
        let json = JSON.stringify(byml_fileStructure, null, 4) + "\n"
        let jsonBuf = new TextEncoder().encode(json).buffer
    return jsonBuf
}
function byml_traverseNodes (fileBuf, nodes, outArr, version, numMode) {
    let out = byml_fileStructure
    for (let outPart of outArr) out = out[outPart]

    for (let node of nodes) {
        let type = node.type
        let value = node.value
        let valueValue = byml_parseValueNode(type, value, version, fileBuf, numMode)
        let containerValue = byml_getContainerNodeType(type, version)
        let convertValue = valueValue
        if (convertValue === undefined) convertValue = containerValue
        if (convertValue === undefined) FileBuf.expectVal(0, 1, `Unknown error while parsing node.`)
        let hashKeyIndex = node.hashKeyIndex
        let hashKey = byml_hashKeyTable[hashKeyIndex]
        
        let nextOutArr = outArr
        if (hashKey == undefined) {
            out.push(convertValue)
            if (containerValue !== undefined) nextOutArr.push(out.length - 1)
        } else {
            out[hashKey] = convertValue
            if (containerValue !== undefined) nextOutArr.push(hashKey)
        }

        if (valueValue === undefined) {
            let outNodes = byml_parseContainerNode(fileBuf, value, version, numMode)
            byml_traverseNodes(fileBuf, outNodes, nextOutArr, version, numMode)
            nextOutArr.splice(nextOutArr.length - 1, 1)
        }
    }
}
function byml_parseContainerNode (fileBuf, offset, version, numMode, zeroEmpty = false) {
    if (zeroEmpty && offset == 0x00) return null

    let type = fileBuf.byte(offset)
    let buf = fileBuf.buf(offset, fileBuf.data.byteLength - offset)
    if (version >= 0x02) {
        if (type == 0xA0) {
        } else if (type == 0xC0) {
            let numEntries = buf.int(0x01, IntSize.U24, {endian: numMode})
            let nodes = []
            let typesBuf = buf.arr(0x04, numEntries)
                let types = [...typesBuf]
            let valuesBuf = buf.buf(0x04 + (Math.ceil(numEntries / 0x04) * 0x04), 0x04 * numEntries)
                for (let i = 0; i < numEntries; i++) {
                    let type = types[i]
                    let value = valuesBuf.int(i * 0x04, IntSize.U32, {endian: numMode})
                    nodes.push({type, value})
                }
            return nodes
        } else if (type == 0xC1) {
            let numEntries = buf.int(0x01, IntSize.U24, {endian: numMode})
            let entries = new Array(numEntries)
            for (let i = 0; i < numEntries; i++) {
                let entry = buf.buf(0x04 + (i * 0x08), 0x08)
                    let hashKeyIndex = entry.int(0x00, IntSize.U24, {endian: numMode})
                    let type = entry.byte(3)
                    let value = entry.int(0x04, IntSize.U32, {endian: numMode})
                entries[i] = {type, value, hashKeyIndex}
            }
            return entries
        } else if (type == 0xC2) {
            let numEntries = buf.int(0x01, IntSize.U24, {endian: numMode})
                let offsetsArrSize = 0x04 * (numEntries + 1)
            let offsetsBuf = buf.buf(0x04, offsetsArrSize)
                let stringsStart = offsetsBuf.int(0x00, IntSize.U32, {endian: numMode})
                let stringsEnd = offsetsBuf.int(numEntries * 0x04, IntSize.U32, {endian: numMode})
            let stringsBuf = buf.buf(stringsStart, stringsEnd - stringsStart)
                let stringsStr = stringsBuf.str(0x00, stringsBuf.data.byteLength)
                let strings = stringsStr.slice(0, -1).split("\x00")
            return strings
        } else if (type == 0xD0) {
        } else if (type == 0xD1) {
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
        if (type == 0xA1) {
        }
    }
    if (version >= 5) {
        if (type == 0xA2) {
        }
    }
    if (version >= 7) {
        if (type == 0x20) {
            // not implemented
        } else if (type == 0x21) {
            // not implemented
        }
    }

    FileBuf.expectVal(0, 1, `Invalid or not implemented node type: 0x${type.toString(16).toUpperCase()} (${type}). Function: Parse container node. File offset: 0x${offset.toString(16).toUpperCase()} (${offset}).`)
}
function byml_parseValueNode (type, value, version, fileBuf, numMode) {
    if (version >= 2) {
        if (type == 0xA0) {
            return byml_stringTable[value]
        } else if (type == 0xC0) {
            return undefined
        } else if (type == 0xC1) {
            return undefined
        } else if (type == 0xC2) {
            return undefined
        } else if (type == 0xD0) {
            return value == 0 ? false : true
        } else if (type == 0xD1) {
            return FileBuf.signedInt_int(value, {size: IntSize.U32, type: SignedIntBinaryType.TWOS_COMPLEMENT})
        } else if (type == 0xD2) {
            return FileBuf.float_int(value, {precision: FloatPrecision.SINGLE})
        } else if (type == 0xD3) {
            return value
        }
    }
    if (version >= 3) {
        if (type == 0xD4) {
            let realValue = fileBuf.int(value, IntSize.U64, {endian: numMode})
            return FileBuf.signedInt_int(realValue, {size: IntSize.U64, type: SignedIntBinaryType.TWOS_COMPLEMENT})
        } else if (type == 0xD5) {
            return fileBuf.int(value, IntSize.U64, {endian: numMode})
        } else if (type == 0xD6) {
            let realValue = fileBuf.int(value, IntSize.U64, {endian: numMode})
            return FileBuf.float_int(realValue, {precision: FloatPrecision.DOUBLE})
        } else if (type == 0xFF) {
            return null
        }
    }
    if (version >= 4) {
        if (type == 0xA1) {
            // not implemented
        }
    }
    if (version >= 5) {
        if (type == 0xA2) {
            // not implemented
        }
    }
    if (version >= 7) {
        if (type == 0x20) {
            return undefined
        } else if (type == 0x21) {
            return undefined
        }
    }
    
    FileBuf.expectVal(0, 1, `Invalid or not implemented node type: 0x${type.toString(16).toUpperCase()} (${type}). Function: Parse value node.`)
}
function byml_getContainerNodeType (type, version) {
    if (version >= 2) {
        if (type == 0xA0) {
            return undefined
        } else if (type == 0xC0) {
            return []
        } else if (type == 0xC1) {
            return {}
        } else if (type == 0xC2) {
            return undefined
        } else if (type == 0xD0) {
            return undefined
        } else if (type == 0xD1) {
            return undefined
        } else if (type == 0xD2) {
            return undefined
        } else if (type == 0xD3) {
            return undefined
        }
    }
    if (version >= 3) {
        if (type == 0xD4) {
            return undefined
        } else if (type == 0xD5) {
            return undefined
        } else if (type == 0xD6) {
            return undefined
        } else if (type == 0xFF) {
            return undefined
        }
    }
    if (version >= 4) {
        if (type == 0xA1) {
            return undefined
        }
    }
    if (version >= 5) {
        if (type == 0xA2) {
            return undefined
        }
    }
    if (version >= 7) {
        if (type == 0x20) {
            // not implemented
        } else if (type == 0x21) {
            // not implemented
        }
    }
    
    FileBuf.expectVal(0, 1, `Invalid or not implemented node type: 0x${type.toString(16).toUpperCase()} (${type}). Function: Get container node type.`)
}
