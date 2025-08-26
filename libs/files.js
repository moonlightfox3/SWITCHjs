// polyfills for showOpenFilePicker and showSaveFilePicker
if (window.showOpenFilePicker == undefined) {
    console.warn("Using polyfill for showOpenFilePicker()")
    window.showOpenFilePicker = async function (options) {
        let el = document.createElement("input"); el.type = "file"
        el.multiple = options?.multiple ?? false
        let types = options?.types?.[0]?.accept["*/*"] ?? []
        el.accept = types.join(",")
        return new Promise(function (resolve) {
            el.onchange = function () {
                let files = [...el.files].map(val => {return {
                    kind: "file",
                    name: val.name,
                    getFile: async function () {
                        return val
                    },
                }})
                el.remove()

                if (options?.excludeAcceptAllOption && files.find(val => {
                    let dotIndex = val.name.lastIndexOf(".")
                    if (dotIndex > -1) {
                        let ext = val.name.substring(dotIndex)
                        return !types.includes(ext)
                    }
                }) != undefined) throw new Error("Failed to execute 'showOpenFilePicker' on 'Window': The user selected a file with the wrong extension.", "AbortError")
                resolve(files)
            }
            el.oncancel = function () {
                el.remove()
                throw new DOMException("Failed to execute 'showOpenFilePicker' on 'Window': The user aborted a request.", "AbortError")
            }
            el.click()
        })
    }
}
if (window.showSaveFilePicker == undefined) {
    console.warn("Using polyfill for showSaveFilePicker()")
    window.showSaveFilePicker = async function (options) {
        let el = document.createElement("a")
        el.download = options?.suggestedName ?? "download"
        return {
            createWritable: async function () {
                return {
                    write: async function (data) {
                        let url = URL.createObjectURL(new Blob([data]))
                        el.href = url
                    },
                    close: async function () {
                        el.click()
                        URL.revokeObjectURL(el.href)
                        el.remove()
                    },
                }
            },
        }
    }
}

async function importFile (exts, excludeAcceptAllOption = false) {
    let [handle] = await showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption,
        types: [{
            accept: {
                "*/*": exts.map(val => `.${val}`),
            },
            description: ":",
        }],
    })
    let file = await handle.getFile()
    let buf = await file.arrayBuffer()

    let name = file.name
    let ext = ""
    let dotIndex = file.name.lastIndexOf(".")
    if (dotIndex > -1) {
        ext = file.name.substring(dotIndex + 1)
        name = file.name.substring(0, dotIndex)
    }
    return {buf, name, ext}
}

async function exportFile (buf, name, ext, excludeAcceptAllOption = false) {
    let handle = null
    if (ext != "") {
        handle = await showSaveFilePicker({
            suggestedName: `${name}.${ext}`,
            excludeAcceptAllOption,
            types: [{
                accept: {
                    "*/*": [`.${ext}`],
                },
                description: ":",
            }],
        })
    } else {
        handle = await showSaveFilePicker({
            suggestedName: `${name}`,
            excludeAcceptAllOption,
            types: [{
                accept: {},
                description: ":",
            }],
        })
    }
    let writable = await handle.createWritable()
    await writable.write(buf)
    await writable.close()
}
async function exportZip (structure, name, excludeAcceptAllOption = false) {
    let data = zipFileCompress(structure)
    await exportFile(data, name, "zip", excludeAcceptAllOption)
}

function getFileType (fileBuf, fileExt) {
    let name = null
    let ext = null

    if (fileBuf.str(0x00, 0x04) == "Yaz0") {
        let mode = Endian.BIG
        name = `Yaz0_${mode}`
        ext = "szs"
    }
    
    else if (fileBuf.str(0x00, 0x04) == "SARC") {
        let mode = null
        let byteOrder = fileBuf.int(0x06, IntSize.U16, Endian.BIG)
            byteOrder = byteOrder.toString(16)
            if (byteOrder == "feff") mode = Endian.BIG
            else if (byteOrder == "fffe") mode = Endian.LITTLE
        name = `SARC_${mode}`
        ext = "sarc"
    }

    else if (fileBuf.str(0x00, 0x04) == "RARC") {
        let mode = Endian.BIG
        name = `RARC_${mode}`
        ext = "rarc"
    } else if (fileBuf.str(0x00, 0x04) == "CRAR") {
        let mode = Endian.LITTLE
        name = `RARC_${mode}`
        ext = "rarc"
    }
    
    else if (fileBuf.str(0x00, 0x02) == "BY") {
        let mode = Endian.BIG
        let ver = fileBuf.int(0x02, IntSize.U16, mode)
        name = `BYML_${mode}_V${ver}`
        ext = "byml"
    } else if (fileBuf.str(0x00, 0x02) == "YB") {
        let mode = Endian.LITTLE
        let ver = fileBuf.int(0x02, IntSize.U16, mode)
        name = `BYML_${mode}_V${ver}`
        ext = "byml"
    }

    else if (fileExt == "bcsv" || fileExt == "banmt" || fileExt == "bcam" || fileExt == "pa" || fileExt == "tbl") {
        let mode = Endian.LITTLE
        name = `BCSV_${mode}`
        ext = fileExt
    }

    else if (fileBuf.str(0x00, 0x08) == "MsgStdBn") {
        let mode = null
        let byteOrder = fileBuf.int(0x08, IntSize.U16, Endian.BIG)
            byteOrder = byteOrder.toString(16)
            if (byteOrder == "feff") mode = Endian.BIG
            else if (byteOrder == "fffe") mode = Endian.LITTLE
        name = `MSBT_${mode}`
        ext = "msbt"
    }

    else if (fileBuf.str(0x00, 0x04) == "MESG") {
        let mode = Endian.BIG
        name = `BMG_${mode}`
        ext = "bmg"
    } else if (fileBuf.str(0x00, 0x04) == "GSEM") {
        let mode = Endian.LITTLE
        name = `BMG_${mode}`
        ext = "bmg"
    }

    else if (fileBuf.str(0x00, 0x04) == "ARSL") {
        let mode = null
        let byteOrder = fileBuf.int(0x04, IntSize.U16, Endian.BIG)
            byteOrder = byteOrder.toString(16)
            if (byteOrder == "feff") mode = Endian.BIG
            else if (byteOrder == "fffe") mode = Endian.LITTLE
        name = `BARSLIST_${mode}`
        ext = "barslist"
    }

    else if (fileBuf.str(0x00, 0x04) == "FSAR") {
        let mode = null
        let byteOrder = fileBuf.int(0x04, IntSize.U16, Endian.BIG)
            byteOrder = byteOrder.toString(16)
            if (byteOrder == "feff") mode = Endian.BIG
            else if (byteOrder == "fffe") mode = Endian.LITTLE
        name = `BFSAR_${mode}`
        ext = "bfsar"
    }
    
    else if (fileBuf.str(0x00, 0x04) == "FGRP") {
        let mode = null
        let byteOrder = fileBuf.int(0x04, IntSize.U16, Endian.BIG)
            byteOrder = byteOrder.toString(16)
            if (byteOrder == "feff") mode = Endian.BIG
            else if (byteOrder == "fffe") mode = Endian.LITTLE
        name = `BFGRP_${mode}`
        ext = "bfgrp"
    }
    
    else if (fileBuf.str(0x00, 0x04) == "FWAR") {
        let mode = null
        let byteOrder = fileBuf.int(0x04, IntSize.U16, Endian.BIG)
            byteOrder = byteOrder.toString(16)
            if (byteOrder == "feff") mode = Endian.BIG
            else if (byteOrder == "fffe") mode = Endian.LITTLE
        name = `BFWAR_${mode}`
        ext = "bfwar"
    }
    
    else {
        name = "?"
        ext = "bin"
    }

    return {name, ext}
}
