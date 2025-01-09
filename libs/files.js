async function importFile (exts) {
    if (typeof exts == "string") exts = [exts]
    for (let index in exts) exts[index] = `.${exts[index]}`

    let [handle] = await showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false,
        startIn: "downloads",
        types: [{
            accept: {
                "*/*": exts
            },
            description: ":"
        }]
    })
    let file = await handle.getFile()
    let buf = await file.arrayBuffer()
    let fileName = file.name
        let dotIndex = fileName.lastIndexOf(".")
        let name = null
        let ext = null
        if (dotIndex == -1) {
            ext = ""
            name = fileName
        } else {
            ext = fileName.substring(dotIndex + 1)
            name = fileName.substring(0, dotIndex)
        }
    return {buf, name, ext}
}

async function exportFile (buf, name, ext) {
    let handle = await showSaveFilePicker({
        suggestedName: `${name}.${ext}`,
        excludeAcceptAllOption: false,
        startIn: "downloads",
        types: [{
            accept: {
                "*/*": [`.${ext}`]
            },
            description: ":"
        }]
    })
    let writable = await handle.createWritable()
    await writable.write(buf)
    await writable.close()
}
async function exportZip (obj, name) {
    let zip = new JSZip()
    exportZip_parseObj(zip, obj)
    let data = await zip.generateAsync({type: "blob"})
    await exportFile(data, name, "zip")
}
function exportZip_parseObj (zip, obj) {
    for (let key of Object.keys(obj)) {
        let content = obj[key]
        if (typeof content.resize != "function") {
            let folder = zip.folder(key)
            exportZip_parseObj(folder, content)
        } else zip.file(key, content)
    }
}

function getFileType (data, dataExt) {
    let name = null
    let ext = null

    if (data.str(0x00, 0x04) == "Yaz0") {
        let mode = Endian.BIG
        name = `Yaz0_${mode}`
        ext = "szs"
    }
    
    else if (data.str(0x00, 0x04) == "SARC") {
        let mode = null
        let byteOrder = data.int(0x06, IntSize.U16, {endian: Endian.BIG})
            byteOrder = byteOrder.toString(16)
            if (byteOrder == "feff") mode = Endian.BIG
            else if (byteOrder == "fffe") mode = Endian.LITTLE
            name = `SARC_${mode}`
            ext = "sarc"
    }

    else if (data.str(0x00, 0x04) == "RARC") {
        let mode = Endian.BIG
        name = `RARC_${mode}`
        ext = "rarc"
    } else if (data.str(0x00, 0x04) == "CRAR") {
        let mode = Endian.LITTLE
        name = `RARC_${mode}`
        ext = "rarc"
    }
    
    else if (data.str(0x00, 0x02) == "BY") {
        let mode = Endian.BIG
        let ver = data.int(0x02, IntSize.U16, {endian: mode})
        name = `BYML_${mode}_V${ver}`
        ext = "byml"
    } else if (data.str(0x00, 0x02) == "YB") {
        let mode = Endian.LITTLE
        let ver = data.int(0x02, IntSize.U16, {endian: mode})
        name = `BYML_${mode}_V${ver}`
        ext = "byml"
    }

    else if (dataExt == "bcsv" || dataExt == "banmt" || dataExt == "bcam" || dataExt == "pa" || dataExt == "tbl") {
        let mode = Endian.LITTLE
        name = `BCSV_${mode}`
        ext = dataExt
    }

    else if (data.str(0x00, 0x04) == "MESG") {
        let mode = Endian.BIG
        name = `BMG_${mode}`
        ext = "bmg"
    } else if (data.str(0x00, 0x04) == "GSEM") {
        let mode = Endian.LITTLE
        name = `BMG_${mode}`
        ext = "bmg"
    }
    
    else {
        name = "?"
        ext = "bin"
    }

    return {name, ext}
}
