## This contains conversion/decompression tools for some Nintendo Switch file formats.
These tools (currently) can only convert files *from* Nintendo Switch formats into more easily usable ones. They cannot convert back *to* Nintendo Switch formats.  
*Note: These tools were each made for some of the **Nintendo Switch** games **MK8D**, **SMG1 (in SM3DAS)**, **SM3DW+BF**, **SMBW**, **SMM2**, **SMO**, and **TOTK**. They may or may not work with files from other games or consoles.*

### Credits: These are the wiki documentation pages I used to create these converters.
YAZ0: [amnoid.de](http://www.amnoid.de/gc/yaz0.txt) \
SARC: [Custom Mario Kart 8 Wiki](https://mk8.tockdom.com/wiki/SARC_(File_Format)) \
RARC: [Custom Mario Kart Wiiki](https://wiki.tockdom.com/wiki/RARC_(File_Format)) \
BYML: [ZeldaMods](https://zeldamods.org/wiki/BYML) \
BCSV: [Luma's Workshop](https://www.lumasworkshop.com/wiki/BCSV_(File_format)) \
MSBT: [ZeldaMods](https://zeldamods.org/wiki/Msbt) \
BMG: [Luma's Workshop](https://www.lumasworkshop.com/wiki/BMG_(File_Format)), [Custom Mario Kart Wiiki](https://wiki.tockdom.com/wiki/BMG_(File_Format))
### Credits: These are the pages I used to create my binary file parsing library stored here (/libs/filebuf.js).
Floating-point number parsing: [An article in Medium's TDS Archive written by Oleksii Trekhleb](https://medium.com/towards-data-science/binary-representation-of-the-floating-point-numbers-77d7364723f1) \
Signed integer parsing: [Sonoma State University CS Linux Server](https://blue.cs.sonoma.edu/~hwalker/courses/415-sonoma.fa22/readings/integer-signed-representation.html)

\
\
*This repository uses the library [JSZip](https://github.com/Stuk/jszip), made by [https://github.com/Stuk](https://github.com/Stuk), which is dual-licensed under the MIT license or the GPLv3 license. A copy of it is not stored here - instead, this just fetches the latest file from [https://stuk.github.io/jszip/dist/jszip.min.js](https://stuk.github.io/jszip/dist/jszip.min.js).*  
*All other code in this repository is my own.*
