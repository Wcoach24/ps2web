# Standalone build of the ps2sdk 'vu1' sample against an installed $PS2SDK.
# VU1 + libpacket2 3D showcase. (c) 2020 Sandro Sobczynski, Academic Free License v2.0.
# No VCL needed: draw_3D.vsm (pre-assembled VU microcode) is assembled with dvp-as.
EE_BIN = vu1.elf
EE_OBJS = draw_3D.o main.o
EE_LIBS = -ldraw -lgraph -lmath3d -lpacket2 -ldma
EE_DVP = dvp-as

all: zbyszek.c $(EE_BIN)
	$(EE_STRIP) --strip-all $(EE_BIN)

%.o: %.vsm
	$(EE_DVP) $< -o $@

zbyszek.c:
	bin2c zbyszek.raw zbyszek.c zbyszek

clean:
	rm -f $(EE_BIN) $(EE_OBJS) zbyszek.c

include $(PS2SDK)/samples/Makefile.pref
include $(PS2SDK)/samples/Makefile.eeglobal
