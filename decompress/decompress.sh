#!/bin/bash

IN_DIR=$1
OUT_DIR=$2
from_frame=$3
to_frame=$4
#ORG_DIR=`pwd`
#cd ${IN_DIR}
#file_num="$(find -type f -name 'buffer*.raw' | wc -l)".
#cd ${ORG_DIR}

#echo start frame: ${start_frame}
#echo total file to decompress: ${file_num}

#for x in $(seq ${start_frame} 1 ${file_num})



for (( x=${from_frame}; x<=${to_frame}; x++ ))
do
	N="$(printf "%010d" $x)"
    F=buffer_${N}.raw
    #echo decompressing buffer $N
    ./decompress/decompress_hds -i ${IN_DIR}/${F} -o ${OUT_DIR}/f_${N}.hds
done
