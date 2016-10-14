#!/bin/bash

INPUTPATH="$1"
TARGET_N="$2"

if [ -z "$1" ]; then
    INPUTPATH=./
fi

if [ -z "$2" ]; then
    TARGET_N=0
fi

rm -rf folder_flist.txt
#find ${INPUTPATH}/cali_data -name "*.ini" >> folder_flist.txt
#find ${INPUTPATH}/cali_data -name "*.blt" >> folder_flist.txt

find ${INPUTPATH} -size 12441600c -name "buffer_*.raw" | grep 'buffer_[0-9][0-9]*.raw' >> folder_flist.txt
find ${INPUTPATH} -size 11536c -name "md_ucode_*.bin" >> folder_flist.txt
find ${INPUTPATH} -name "md_arm.bin" >> folder_flist.txt
find ${INPUTPATH} -name "*.mp4" >> folder_flist.txt

TARGET_N=`grep -c "buffer_" folder_flist.txt | tr -s ' ' | cut -d ' ' -f1`
echo "target raw files should be : ${TARGET_N}"


###check raw data
echo -n "checking raw data with size 12441600 bytes..."
i=0
while [ "${TARGET_N}" -gt "${i}" ]
do
	#grep -q 'buffer_0*'"${i}"'.raw' folder_flist.txt || echo -e "\n[Error] The raw data \#"${i}" DO NOT exist"
	#i=$(($i+1))

	if [ `grep 'buffer_0*'"${i}"'.raw' folder_flist.txt` ]; then
    		i=$(($i+1))
	else
		echo -e "\n[Error] The raw data \#"${i}" DO NOT exist"
		exit 1
	fi

done
echo "Done"


###check md_ucode_N data
echo -n "checking md_ucode data with size 11536 bytes..."
i=0
while [ "${TARGET_N}" -gt "${i}" ]
do
	#grep -q 'md_ucode_0*'"${i}"'.bin' folder_flist.txt || echo -e "\n[Error] The md_ucode \#"${i}" DO NOT exist"
	#i=$(($i+1))

	if [ `grep 'md_ucode_0*'"${i}"'.bin' folder_flist.txt` ]; then
                i=$(($i+1))
        else
                echo -e "\n[Error] The md_ucode \#"${i}" DO NOT exist"
                exit 1
        fi

done
echo "Done"


###check md_arm.bin
echo -n "checking md_arm.bin..."
#filename='md_arm.bin'
#grep -q ${filename} folder_flist.txt || echo -e "\n[Error] The md_arm.bin DO NOT exist"

if [ `grep 'md_arm.bin' folder_flist.txt` ]; then
	echo "Done"
else
	echo -e "\n[Error] The md_arm.bin DO NOT exist"
	exit 1
fi


###check video_h264.mp4
echo -n "checking video_h264.mp4..."
#filename='video_h264.mp4'
#grep -q ${filename} folder_flist.txt || echo -e "\n[Error] The video_h264.mp4 DO NOT exist"
#echo "Done "


if [ `grep 'video_h264.mp4' folder_flist.txt` ]; then
        echo "Done"
else
        echo -e "\n[Error] The video_h264.mp4 DO NOT exist"
        exit 1
fi



rm -rf folder_flist.txt

