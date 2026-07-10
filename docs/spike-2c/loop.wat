;; Prototipo del "resident dispatch loop" 2c.
;; Replica el modelo real de Play!.js:
;;  - importa la memoria lineal de emscripten (env.memory)
;;  - importa __indirect_function_table de emscripten (donde addFunction registra cada bloque)
;;  - despacha bloques con call_indirect SIN volver a C++
;; Estado en memoria lineal (offsets de ejemplo, en la impl real los fija el executor):
;;   [0]  i32  nPC                (PC actual)
;;   [4]  i32  nHasException      (0 = seguir, !=0 = salir)   -> respeta HANDOFF incognita #4
;;   [8]  i32  cycleQuota         (se decrementa por bloque)  -> respeta HANDOFF incognita #4
;;   PC->fctId map: hash abierto en memoria lineal (patch 07 reutilizable, incognita #3)
;;     mapBase = 4096 ; para el proto usamos un lookup lineal trivial de 2 pares (pc,fctId)
(module
  (import "env" "memory" (memory 1))
  ;; La tabla de bloques = __indirect_function_table de emscripten (tabla 0)
  (import "env" "__indirect_function_table" (table $blocks 0 funcref))
  ;; Firma de un bloque compilado: void block(void* context)  == 'vi'
  (type $blockSig (func (param i32)))
  ;; loop residente: recibe puntero a context; itera hasta nHasException!=0 o quota<=0
  (func $dispatchLoop (export "codeGenFunc") (param $ctx i32)
    (local $pc i32)
    (local $fctId i32)
    (block $exit
      (loop $again
        ;; salir si nHasException != 0
        (br_if $exit (i32.load (i32.const 4)))
        ;; salir si cycleQuota <= 0
        (br_if $exit (i32.le_s (i32.load (i32.const 8)) (i32.const 0)))
        ;; pc = mem[0]
        (local.set $pc (i32.load (i32.const 0)))
        ;; fctId = ps2webExecLookup(pc)  -- proto: mapa lineal en mapBase=4096
        (local.set $fctId (call $lookup (local.get $pc)))
        ;; si fctId==0 -> no hay bloque compilado: salir a C++ (fallback FindBlockAt)
        (br_if $exit (i32.eqz (local.get $fctId)))
        ;; call_indirect sobre __indirect_function_table con el fctId del bloque
        (call_indirect (type $blockSig) (local.get $ctx) (local.get $fctId))
        ;; cycleQuota-- (el bloque real actualiza nPC/quota; aquí lo emulamos)
        (i32.store (i32.const 8) (i32.sub (i32.load (i32.const 8)) (i32.const 1)))
        (br $again)
      )
    )
  )
  ;; lookup lineal trivial en mapBase: pares (pc,fctId) terminados en pc==0
  (func $lookup (param $pc i32) (result i32)
    (local $p i32)
    (local.set $p (i32.const 4096))
    (block $done
      (loop $scan
        (br_if $done (i32.eqz (i32.load (local.get $p))))       ;; fin de tabla
        (if (i32.eq (i32.load (local.get $p)) (local.get $pc))
          (then (return (i32.load (i32.add (local.get $p) (i32.const 4))))))
        (local.set $p (i32.add (local.get $p) (i32.const 8)))
        (br $scan)
      )
    )
    (i32.const 0)
  )
)
