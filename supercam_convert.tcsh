#!/bin/tcsh

#inputPath=$1
#outputPath=$2
#width=$3
#height=$4
#num=$5

foreach x (`seq 0 1 $5`)

    set seqn = `printf "f_%010d" $x`
    ./apfaddheader -width 3840 -height 2160 -noheader -plane Y8 -plane AMBUV0 -o $2${seqn}.yuv.apf $1${seqn}.yuv
    ./apfresample -ow $3 -oh $4 -uv -o $2${seqn}_VGA.yuv.apf $2${seqn}.yuv.apf
    rm $2$seqn.yuv.apf
    ./apfrmheader $2${seqn}_VGA.yuv.apf
    rm $2${seqn}_VGA.yuv.apf

end

