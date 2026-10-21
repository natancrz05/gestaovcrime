import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { registrarAcesso, registrarFalhaLogin } from "@/lib/auditoria.functions";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { solicitarAcesso, trocarSenhaObrigatoria } from "@/lib/usuarios.functions";
import { decidirAcessoAposLogin } from "@/lib/login-acesso";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";

const FUNDO_LOGIN = "data:image/webp;base64,UklGRnJzAABXRUJQVlA4IGZzAABQvwGdASogApgBPrlOoEunJCMirPYL6OAXCWVuBVrZOdfiBNb5dv8fnE8W2wrh3tVu47DPPL4bk8/72BgC7O1T+GN9hb/G+Yt7v3tfULuJ/7p0GnqL/su/fegB02FpUeY/1X/T8Lfy/Yz+6/6Pmr2Xv8zwH/XvEIxm7TDf/MR9+8nP8fzt+2vRR/4PG4+9/9z2C/6d/ovV68AP7D/3vYY/sP/D/cXtuD976Nsu+gtO+HbGxWownv/BBXsfh0Z88pUX0tntuc7VwQ+86l2/CQje8xif8r9fGv0aMVLhtr+TxskskCKpqArBxshhyM7lfhj8qfEAq5Mb9bb5XFz2Jla8C0ZWKqT5iHZ2wGj1VaEWUfN2wP/uF+OxJSzxLQaIDW/nh/WkGRpEYq9NaVMTbRTqL8wOf8QWkeJJv48obtSalJsHVeGrCu097HtevX0mFcYsFW2DPBU6PQa4okoDnjHg5UuS1qxWhkj/RBlMPMUBnvs8GoWx1FuvTNFE8L+JG7tOkxGh8J9cHziDSZtSZ4kgkduOWIeTkOA2DIusz7akqDPzJIf+bL93VU1tvQUpb2Vhqf93c3jZtsOVFeXBX26P3lznve00uOF0Z+FFN87KG6sVzwZefLixEPBVQ7mvl4qGl0oodPaQdy5BP7VF+jT9SG2IN2EnEsJfPNnBAGbsHAL6+dInSPCzglvK8MgY/JALAjML5r0NKbIElHWWzjIrErvTW588ebQ53Dd86EIPe6652JywBAEga1FmhK+rMoF4503JNOusB5NwYFee+NGp3Hln8ffIiq9Z8JwYVnYz92uZ44n4sP9zbjt7sWDPT0w0wvvv1fsnxEPC9QonuK1/CMScE2/76L5P47Ux5UUihNyEoIiL7ac5rcVJP9HceZ71YJ6BxYFAFY+gnPjwuaJDJ66v3W1XJmahm99UgVxjAhzqvYs/qUvNw/a5tYZwwhv8QkQhwUWNQlLRMmJfZ5X/xqy/RUvSQ2o7zqlapg0Sg7UUKUYgRvrJ9Myt9Sk0Wg6MJbkMRdkLA10BFb5hoUCgDrcBt52M0VyvK6ZgD1SAz/2TS1puFaoVBkVwkVa1qBbeoNHA0k6J3oEoC04plT0RakwFhewfW+WXL9Pc3JKaobDMHtq+Ct9dkr0rYj3LGhvaScwmQFEFKLPmGsfpMGwFIQT8k5kzpy7lBt8L40MgBKs+qyKHGTFEoTiD2qy/RKoz/kpblo04qVTnDrU/OBFbq1yw8oTchZWm728vQs+vvjbMpxqB+mWD6Tfpp/MMJ9ZcJgzJAkeVWYSDsGB5LpjjpjtbJ22NHT63sq42+0+vz30KiBF43JFWpmLnLvxH0DdBQJUmArawkuSYb4UDEFGcwKjIgQGQKNlcGi4PY0s7MZsfsS3usvwjsm8BUtwUbu6KeCZ/NYIqAqoximjTNoD2uuqhEue7Pb1J1QHTENZ7IIMkuERl+7lrGu7ks+Mc634WblXZI4EAMwzZVsrpdaFt14yJnPYMLnjs+IDklRP/67eRKvqXlRcMlRYi87sTdDbwBpuMyZRLwbuqhMONI0q0Ng3VTmFcisa1pvwX4BHPwKAkCTIc3OCN7LcFcALwhRPuTQ3EfcLqM19PBxMNTuKatplHS/YARBHD0q0BenrCGdjZvjSxM3QbyaCzhfwW8hnZk4xHk5Fr8hRNuUcBQu14U+VDjKgTRBErZGZNYHNayZ70m2I+OMU7MVupXuuwotE7SlsdK8AD7ZMJiIpankLpvsSm3xXWDkzPCrSaxnf8pT4rV/q7kEb9WR75HLZ/j2Olan0RX3rK3bBw/ToqS36Ph04pzn901x8pAYEeJbwrinp9OMxEwy/U85rY8vmG4rzwiXqBa5Ibn3g7wU7dR51xCDEA565jmv1n4JC2Yp1v/p3Ygyg2Pqod56iurkH/MAuz2+DfqSw0zscG1JD3+3qfRZ/+YYjzEkY8CStKsyEiKYDqRxtpxLHjyN+oBxSdyLvLdaY2wU5TCUt9+zKNl87lg9BTwSmAkS+g3vu8nDWZOC4/4iWM+cM5RzqS8vftPI3zW+eIKlcA8I38WxfqPLtalKo8BTUIGv2S0CyPRxoFX+Xpa1gq1IzrKyLRbKZdaDgsKNdmTw30H+dhFpBAR2Owf6IQJoJA1ZNerocCX8LuZe3LFWH1QY5u9ePciPFpbllJqnD+/ODmtpNSImc8weVg/YTtJ7NprFFbbQCC1dHA1HX3RID3Cu0FJfHx2s3oEkj9+jTN/zm/7Jy1AR13JhCKszFw9teg8jBvPQHuD32rTUSRE0PmNK9sJvKAEGRYKSQ5C8k5ntR8DUebzURKfotm19MEHLUPnTh+uVPpLnOAN4U5FfkKjC7DNr+6dnlY+s6zX0MxLR/3t0T8WjvUbYFwTyIkcKQilxyixDFuNYkZOEL4yuHMqeWgnuleHfqANhDFaf77P5FunWYxwX7lwcHwDxZXdAU0s800tNH1ook8Bxtjp/A5FSJGrVBAC36WmbfMLeWNQaAwkCBt4TudLAVpJx9nNn5yTitywG0VvEPI4+loiTnd3OX3pDFoLVQTE8mrf9GJxpdBwFTOh5R2LacpfOPtg0c9sG2DvJ+TGH5dEh1TRP9BbpVIwGHOL4Gpo86TEbNjQf4GR8mxsTentQQU9UjvxE3jPZ6F58NwKYrGaCx4oVJqPDJ72q94ij/XLDobppXRAC1bmgjYJdaLVVcezuQByH58uCh2R4CfYADViif4RbzJlTnpymXy6apSHzYHUPhcmj0lbEZIBN3rqdLA63rLc+B5w9GvSwnNO5/R4hX3u6a82wrgUEAv+FiJNEI22O1v8iZA3vcp8a7rYC/LFB/IUTg9YXFDteqIJRsKJLSA4EjW0u0WCedwQRYbvcg+uM85dkikOIQMi626ZWlieLiRDR6EJKSQ87G6iOe3BT9H/rEE8RTiNPT+MQC6N01VySwSs30OW3vmxhM2meYt+12c7U1HmsZsP/QF4Sf1ynIeIQ7Vhm3PRMwwjFT4wgBTGonLY68kNKwxWTF6o7N/QIUzEZEEdBBNbBdX4U+ItIg/LyjJbn1uDSOq7dssfqFbGWuXn098YtMjZoJP38cMx2GQGhz2uklHeOIlaSlsIrzkBk1yKXSbhEfTZTs1q5uZDoDAhaXo356551tsiEY3DUxvP9NglcaWffl+Z2UTVD9u3sKjgTakDQkeQV0/8Rlnb9t4fMWIiTQZu6dokKQK0YSXd446uvfY9qxv3YHqXXpRWEICCdz8ZtpSuxM4jQh9Pc+KH8Zk1Pm+jLdWohRy/RBMixr0IGxyuJzXsX4maJmgrGZoC68t+oriU0Irfpp/GFe9NQSVkdOsoWwYLrCcxTC7IQkyaRmD7z398UyVE3+wHIiztgytNY7S4ECJDNBf/eHqq5q0JJfZyy4pSG8tz/iOxLzDeyNtdYj30Wv/rdqJ4vMlg3Wi0RszmkGM8B3+nLdc9zVghSXieyTkGnN+bf9bRX5DEQr80UVLzYfu32+rb8R5FrWs+n2z5RNQ58LOxDu77pV7cpkBWIds/Em4qFgzNGnOFkm4smTxqFdyU4fFdOMsBcn7Ta/TdD8YrfqZUcQYg6f9FZgXettR6sdbn3WxX+sVK1/KhqZY/s0krr1zUg7UIa5lZDL1C0ilR0bJJIfC5pe3IasxJrUC/yGn4STb9tg9n3EqdQnKgq2ajto/9hl3lBWihsYwaa265hatPDDlS3a0oj81V0CqoksNF+CkrYowtY5EKrjy7B8kLm1M6g3hLzH9CrQdRdqq956xN0kWXcmtFnF2BKs5MFJwUBno0MmG1nkBq9pymrv2jzQXTVxpzTDt7unBU3caTilXxsTeUyEIi/XOTi3Vvrf5sUgxks2OV8HJ4a5MTfxSpWUwFKU0xNVeBmv6x8Z+6DZ61WNrb4VVOWBypPOl+HFdjAveG/48hBO1XIZiVFtmconXzDt1f9Za2oh3e3ujXbdHsNgSyjtjP2Ow+PBMnyF8Z68qSnIrvW3SThZIyTrov/X65RXQ4wctWcjhCIst1AZPm7MZTC6Ne6srS7UKPJNppJeazbzGQCkJVv0AFSpq/G0j+xopfGnz+XHO52ctasgkDtb8CBLx6UpAfeYqUg6XcEUr5TS2RNB5i2Mb5UWZAJFlK1ftXoH1l/ILs60LmOZ75G2gk69bmXzY/PoniiwYKWveefS0RbFJrodzfe+osK//ogRGdRNHiq0xOw+Wj6gm1woggwsLUjttuCipFhHkfjJJDxQ6Xe5ZPcYkl8/r7h7XtubE3NJfbRm5FbXJ4X4gkEjhcK7txg1TS9mPbIHHxhsyEWH8uumf4haOz8JySqNNqznNufJJrC2Cv9GPb+dDx/WmczX4hJf1tJJhUZbHO+a8B33arfCGnFVMHniXsQaQUx5nrZb4eo5ntG5JRyasmxDaotCgoRMVxd45BCmhpPUrAyh0MMgPa84Qh6rcYjBcDiiDMcbvOIfOxa9UYY0PZpQP4Ax891MNc/g/izaoWMjYssks0ibTE9SKaKLEf0/HO3pK468PU+AGxmzYljYv5c5qZ8joj3kVV3aSntB4yxo2x1X9MoV7f+EgzEeEBloibmxYXVO8dyf/DG83F7IIkwabhqCp5ysG3IVmg8LJ52z3sCXAorsDRwTYqUFWPP2nPoZV8CDx0zMEcwzD8DmNbs6nDt5LswWycVnG0NG3LY9MrePluUPz/KxBr369mHKb4YH2Rlyo5aE7MFxSGg9KHNpFunbCZZPjYAzooUl8ejt6RDyEbcRnXoBX/kmG6+XlMAD+8a6RxRFDmNXU5VE+hpfyFlplbmdk4BSHV7rTGdkOgNerEsysAKMdj9pv9+wqLZEub8AHKLudY74wzkJkE9FtRcyEo/wjSB2WzEDO3XxImSmMjeQr63MmFPgFtn2GEGkJL3RbC0jN/qEgjUXhO5XkPI9atsWTND81MJhq1rTrOV7W2AJaRL+ZXkjWIxxPLgmnyHKP3nU9RphPSJ2kX7mMwxHviWs0ArNZmWfyArynS+El56XAqbx0Yj2hL19eXSzBWe8qrAfQA2E0pqgZqyxhlSbRwvCDY6kWw+PxZnRCFE4pnFSVAF+3RBNriI0o0TGfPMIwZISrOZqcXt2QZmu3NJHTa9NU8o/9OPzCwjLOPnNQL2Yyk+oCmCZAh4KNxqPqDsWqLP8CiUGfhKP/H+W8VV3DVP7EhV0AQeIsYhflWHx5/yG5YzI7Chx4c6g5oXAfLT5miP/OLscvvcYMMhU7Ie/GJKzNLRx6WS0+AggI6LcwKz9QfBJ3XGQg5gWfS1GHeEzMf+bjnXtTIzOMvpToIv2aenzb22+5NrW9w6SXegVQGJBe0auYZtPNlJzkM8upvtfgnj/wB6yU9ToD1y8lr1/7ME+BYE0MDSjsXAOI98NIPSb+04t6k8envEzpqFbWZAT5gKJipXxPdazmc21prn94mkP5sGJKjOjyst/Y4+Hd/V7a5Cg0oWIjIq0+VyhEnd/QXnIZtjfwEHi3q/xOiT75g2MzMMpLeu2N3g5x4gkuiNlpuuB6mtvcJzlG9U0dpTmWBQg2+nwRuyR/eRWM0MzCJymg73Ghzw+LayDW0X0cTCBzQ827vzcEYMfGAtvQkkmzRAx/VpZShPQDjHcqJy9o9OsnMUibeY68AgMfUPwOi/VXfmWf64Q37dLfAaMUIEVHiVZ1kuaixYPnetDExYSyU4OgSX0vy2F1Z94ZuGK0OObysZHszZrTOislrmyLGTvRiGXbfo/b6qFpgFzG7gqlzj2aAnquK5uTQgoUy2FRUvrnO2R9p0BCC7icbdsnVzrf2xi3x9wRf3OuG75L027zwfn2rg4rzW2W9pFUhux9JUruJeRIhM9A0cqzkI82XCzOMWrewbD7quWMJFoJ9MxrISO8dGDEid4+23e/NeoP21VHw3w+9a+8ItIM7eEx34hbiKZkDUy4FUYStoz31m+mt/crDzI6FFhZsnG110Vxs+1THvuqnFiQExcTmFXXSb8pZou50IQuuyVGmA1h9bJUEqLJ3dkHcwB8BVSrW/ZC2zXQbo7Uv4eXcRquxY2JKRNjNWKH/Al6JYIAzd8ogvWgRRIpuW0uEGNWTxyfpR59eoat9uxgOHeTfs1KKjHbd9WBtLHylqII5YEodJxmIgaTyKdoKT6ohUJVyKse0ADeYus7oGrtrLheHmShrPFZJ9l9y1fcUAoqMkeZX02bH9N6pbzqxmz3pu5uOYIxPJMLNUV2MuWSF5ZKRDUUZyjYVzR0smgi4PggeR6ifj28pZqNXhi53uFtxtZOTnz5sEflSfwHVu62s6HzLwVjN6DylVOAccZoKF9nQwzbjKlnC9uwQ0nyMM3t2TBoBb8fuzLqDmhWF94fruHbJ5srWOXlfCwPBmI0laeANMJi2Xj21YYBd9F1kPdiPbS2a9+zLXpChzK7+uE0eLpFcEen+x3vjeqph+cyEPs0MA/yiaC5f7Jkrv3sRtP7SckKuYDexUWci/Nm4USjHYfw6DuqV1vtPT+CJoPHN/E6SHXTppem6+Ymxqdqr3ARFZPgmjSRGG6HF0XbPd73AXc8W88m6XbYyrY9YArunA/W1sKaf1vuUvk1MRBEJtMHfo7jKC87XrCJ8UBd7qyClJnxO6+zcDzc/ccp8Kjzqm09v3rVgcH4g/BHftMkgJ6nC/9hzfcTUhxLYR+Bc3fNMRB2zXYcyY8dm6AynsU0Nu152cYqhpJW36KZfSa2Mc1JA8DFWAKJZqDXCb68TL5aOldzrnNoSsnRWwrX/ThnQmBsH6qpvWzBTTJGYqo7BUiKc/GNVL+80AykbYNjSTLVbQmkFL2Qt4GOJC8AAOupDnU8uS4VTBE6JrHcblRs0wbMxYD7boTrLRhSgLXgNnMLt2gjjTMmBp16+AqzWzGv1mi6cY7GQGwvxWB7HkyL7N0H0mcD47IJIUwIoBauKggb2vgnmqWef9HP4qAUq5vUvjqkYH2k0wm7dNIkag33y75CYgjw59Y+lb18lSZ7zWADM0mpt4V999Rdj8BluKN/N+aydGFiNPH4M20gSPL2abT8LBmjmbwF2PT3q4bF47BrxBk4iiRJzDp+vsRTSkn3s5iM71XIXppgk/nxxSnUSjcMdUm8k4D8X4DHUDYXsFkONqAd/aY7qBMuXLAAGxZAwD3jV360I2CCGg2Lqlikf8owJy7Kmb6jGqK9me+Af7PRL/Tb/Q6ijwcQUD7uqsWbu/DCSjvOfRD4ObzFAijbAQqLEMdyCscqzO223CzrwnX0K6t7Ty2HFnLU9HCR9XiJFgGTWb/Z4McxhvW3N6/t2vuU3cOyHmZkoIAxqvU2rkyC98fHwh65OniKrvDtKTmbNT0wBSlXoC4sgOshu04JUcT11Uw3wCZDeeos6mSaPrJUKXWv80Iq3D6Ti7r2Q67W2WFtB1Jui7wZti/6KwVaSxIXmm0ugpt6xYZ6x+Lx31Rjarzy/z2EJvFCXQec/hv98fpIF98HSyq+7yzVgJ5zgV07+INAWb7CdRDXnynZsYd9+nbsfkzue7el18sLrOZSt+YfgfDawLHomBB/MANZtoZMuIqOEN6YS3EO6G68bFiAXADoZRq0UiB35XIPA1stPv73ndQgeVr95LOoIdLl9cKMxaeBTnpONvLa6s5nih6PNATzMtlELmMCMWpXZfn5kezu7JN4iDk5uvuv55DEMHX9cTzjtWFKsVLyrST7n+ohLbgTBbrXcQizufldUsfoqEl8khWRyQdboTt82L6Qa9M/RFGIBl41dt5Zg85PK3UxC+2oLidEKnnLhpTATsUsXD4qMUx2EQcezZw5Vim2lIHXYW6ARnYnHfS7Hvabx6ruQySZ4k5R87dP//4NBUyJqPswc28/bvdfUrlsL4iMx11L12zvlFZHpVkUBwu+IJBLtI2SqzjTgVeWzOlDrJENkVE/Tkgw9qZN6+zgikwxy7u4gC6m+DV6EMJ24hbdvKDiMaDom3iem3M+pdD2nVsbWNvEPy9Nhtf32UdRrvyKPNj0bXETGxC1vgIG89jlIWdbmZCkGwKf3qoybSDPycaADpLozupcaa64tPXIRlnJz9VFJxkMoVNeWZsCkse6z1g/IHd2gWEikl3nzrq2GZsr24c7pQ9FsQe7ldDgp3Km9u6GXRFX1hlT81omd8Hvwqocfb28lf09LDzjc69vzbJRrRUXq7cN1OhCvJCXl3Npybd+HLQkNA1cZoGia79tw91sSNWworgx5JcCQ+MU9oTkks0FGQv410TR4XYMJeX7uuFqdr3p16Noo6iFmrm1/ieIj9HPAKoRSNi7EQeHdpzaS4M1gA7VIsgaB0g4HZ/OAqEhJTtt83rC89jBwfaun7n1PtC9stnrjGjNsuJblXREsYXnNVKLZH67/X2ZlvG/AJ3O8iyJugeNSCFkm9IdyvAv0Vncu58neh63jg1ikTRfqFwnYfT2eKGDu6g0qSOVUXpV8chBoAXT5vzl3AW3lRaHvaF+Kuil6CU0O40vARTRJUCd+2CrKCN8qUo6vLs7rPpUH4mZuLiT4A/RbNkh67cNpWyXtz+YTC9I8KVLfvvRw/oGybAP41QhcHxgtMAPP4BAoZQPIqONnveUI7tvbg+fJNcfZ6ECQMnvo9hxAoLntwFwgZ5rspUtvzjSkzZd1v4bcHSS7+URi46KR6wzumcY18dSDOMu3OUWSNIdzWHOh9wjbrbvAlLxYGZxkvLV5tY2esMbNPUluvtw0mTWdO7pm3lMlAhJK6+U3VMmVhcDJPpMfxco58boWTDcj2l4J56dBRTinREdY0sxWlh9Q2vlZdLiZbk+EzAvRq6ZJ5sCJwUyUtW8UorVHDo1H1xQXIJyFuxRrWC4lKGNdP/OfMFqc1+9pAXp9WzWtPnq7cfoRprUlYKu8WYFuaLdTZToiEOp3ewoAescgR1QJakVnhH38jDvDSNKf+6YhaFji3lOM4e3089oarz/MIaqbXpr4CNHcrcke8/uRPJBozcMs/NbF/XJc7A5mxqBI14T3by5/NmViBdswztLf7w96wEOM/fzK/d+6uJUtKlrPLZyrkjhcm5nGCIanY244+L2t934+hqLEYEJU9kddgEHems3rw5A9zClfgGyAbt/s+gugLKett7xLVZTWFIu2MiJ073XyM7QXYklKntFSTLtOox9CeW97XQ8wf8hY7+ki22Rjtk68PjCDNJ0THY6jTcln/Zf94QFRkxyX3ybwyFz+zbAgtdch6Zb7EysJP6ukKn6aoYd0zeXAG3fH5dydBDAjWa/InF55bSYepHq+B1o4oCRq70iMKG9oRlbQmoi04n40tGkOVjfpSzstcFfy7wAYXCRkA20YHuESe1sy9jzgNKUAuSRCkMHax2hw3Pbi8xMAXoWXzx6muwQBWSwZjr9orBM8b0LbvccP4eiqaB+WHXrZAtPLBQfXwmXAO2Jrwkze5KM3kKyJDFP5aQfyKtYsn1BuMn32xqraktbzmxXArmVpvpmBdqlWA4jxfQWS+TTPAWnWsCd/wpgJXk4IcebPWf5b0FGNbvTQGcaBmfdZAm34ZkmH2kDK/mJG08qv920wwplXOXyeVN8f2acYK6V+Fu4EKya1rml7qNVF/NxGdSgAhGH+BhtR0P05MLYGAB9T7j0A9Wx72yHDbYkveyL7BOHO6nmg5filZYMrN5/WAvX4WGJHq43rlOKD78zcHHEhh2ObBwULGZCAcvbL5LhL6wip9HvrDF8x5SquaTBv6UdldAb0/NhwKQU0t/xvnyGP73lO3o9QtS4c9wEFYw7SNZb6lW5T/Lg6bVeAZqDzbo9w+5ogvcWuvOdl/vJXMH8sslrhUras38hIg+3MLQt6PBHGqSzJ0oGjhna86xxsLSCo0EHqHKmfp7gfx/zJ5My3Rtd3O4XjB+9Zj/UaBgA2U+JjH3J10ITk3WYxiCmJ9q5nPczXGXYg73c4Z2B7UWl2WjV2oDH2EyKoRd9fhUXELLIPSIZATIONT0+kror27GnpitVe+B5vcLqkeJT2BiB2qoqWqssORWhLmktIU4ZjijExAsmwKn9PtBNcojpRtRMEaoJx0UapmNTOdIktkXT/B/jPeKFQu0RVO60xwmveUTn+3MQTGXMpSVdBmfuJqNH8dgkwmVF3XnyAfqIMX/YbUR3YmxHs3dWFba7JjgEHsQ/vHIZF4y4CTsVdVAzvXpIGCbvu+4S6GunvmqGYIrBvyVNswwzmmT9lcayTOPtI5MPX/xrvDlRb21GySPnzId98IG9Uzk+JCyJdZrc2+41Kg4xSC50Iwoft4/djqmqDKLas+y5gefONXwo3S507C2UgI2sNmxgBWqrDUl+bBnunEAq8uFE6FQ0axzN479yWZqK5Cde4x2N4al0CmQxs0et7mTKfsWiuerFh/U0PrTYpfLI1N4EMEOsmsV76SiSaxh4cmc1hVyNAyTGiNHMO0AP/gV8oNG1kFgwotww+H8TKE6PkwZeM4f1GeuPukqa1Ei0EM/IZxMdCMuKf5xpsAC5jHG4u7y3W6vPhUSn00xSoHFKjo6SmlgtgyAHtSCxyAVd1B+rEA40af5jBMhlLPfuD10UCyu6sYyOwCRC+/MghEnN+dyvdVix15uMns5pE1JGof8G3THLzxOsyvIIAAEbaxrIB4Y2HkAR4icl5OOvC5ROe56LW3bEhNn7+XZr1JpuLzUvgrh3AqUJkPpt752wYz46JM5niqQgTQ6MoEjH9MI1fHblBRVx8qv4Qkc4woZQZKENK4Iqtg+YXu6tkC5LzPF1q/WsKb9UTuAOhsC1xnUsHXi2KwoLPweYk25x6+zNHhejA4qXXr7xh/SeZFyQLKy14TQczANM0G988Nxstnry/Q40w1/Kl5Qhvyaq29EEnnlfYB5dtOAmfxe+zFIs17XMAiQ11/QIJbl+lOAhKNaAc9qfSK+2fwcRgl2zcLdS0utEDC7MKiWSz7qdev2KFyRk0hcw08a2qJke/bqpCjxTG/1S9DzHdhbCwraen9sX0fQ02yji13PZ8LG6rdDzp7Eyd7nYfVIMGwapsn45tkMaFYsQ3wEQSbKw3wUiIhtVm7VdkjO7resiHifBNrrqze2IWRZWLYlJgLiDnDSVATkbCs7Ng67f6OdjgX8ZdYJbQp7eagFEl6darZSbA4lqDI2Yu5k5j78F9P210rCi+EiddeqWSTThy3d0TAIziUFadEXSEY/RQUDXYUKtXbKeUr0u9IHj3GONWTmYOpvb47qgVYv23XfCT+Neqef+a2YBWf3jlZCISPoUJyIyDUB2GDgh3EIBJ4obdo/ou0y34xLqvMeChG4IBdPyf2mVYGhjl/Gufsv0z6W5T2wdan1YCqdzoxUZpk5saFkSbAREzHlpbEmh3id+3UvCfekqTVpp7v+7FqJOuztBtvpw2t5JYaLD69LAGNEadmIqhkG7qHGYeUR6uHDKCjPtupeyjrc4JU7z4C0UZranc4GcMDvLYFl3kwt+HAJwBkrNuCrPZW4YZ2fSQ1++8XQtaLMzaIYY7Xnb+Lra/pzYC9q/LUyUdPVPBExa7Fd4AUyhrhPPq4u8RmgBm+6Ou/xgoNfMihZDSUpmDQgSkTyju3GDP7rsZ8HxumrigewbC/s/oXG/7m2Uwx7YaUtdqfcd9T+lWVU5GVdpR5rWHydxG4LAyAsZ/yY5NPVHmiTz3eJjYJlfkA5mTZ8634m9o1cCJv6Ctjpvt3ngSeLNec6YRjJkmbkl5em0d93oBmmzKkf0ilpnHIgs10VdlV9EM1IycPf0Ogvr8Dt83aR/EZoeY3L5S5F4/NxDHhJVvqMRHWXQcGeoLOvXXLPFCIaDMQ2bTBr75duc0MNT0vVlcnHn+Cn5dm7qioMJG2lU5ut32SKsOR4KdOcNxvoS2Fp74SLmxYyVwaQ7AQmYQw6udI1uuTefoieRKm7m1nHPpYyesm9E9vbzthISL8iAXtvZ7jl+eOu/ZmMABZMkAj2+xG0KweR7JFPa4VVtX+Oxw9JFBGYVCWh+xVBWznBWTRsUZ3MsaVbOH7PCNvu92CdvY/AdhvDrbZFBr2Xiaq3a8amX2lpnUfE+UPD7i0m5Flo3Q+ZS7TVNmM7gty5afO2i/jsArM2T/ts2N8AOIOzfGAMMor40gJ6ij7dPtTBw5sbkFfv9rr99WIYzp9tGoG4XqbWAa5FqpQJPWl8XMZKibE3FGdYZvcadcSNcSOv8/ojUhR5mDTkQDA0SM+blCz0CmHmF2hwcRYzw4ns3vAWFoyJ/2BKoAmEhW13apVNK8ccgZw28UDf+NEZMKwK4uXTfXw8MKL1oa80yb5gmlXCrinM+Yl4LwfUX+/hqXKhIOi/4HzaweYq1CXGOaRJKCfddO42ft6FHgtiQ/Ne09s4ZteVFvKnxvKn3U2BymV6bfpbVVPb3nZdPgqGxABwich9L1t7zovrkxHhSXPAeJVmZ/RASTxFElHAt5cyfl93Y5RHSPPEDC8UvfYUPHt304gLDmTnYUzolqOLzUsj6BxPUUFPIlVs10X5ormobF9bNKaTmGOSyD0AtqNo5LUs1WyjJkS3waMp8Jv2uOEavQyg6ut+K3Miw21ewfceHex5ciyohU008sA3zIP3y+222wcbyc8yfqDBk6kZs0BZ2+FqZVM7vklbEMkRgPCF9hJLnwleB7gS7rCT9df0qiTLQ3KSL/QwXWDApFtXrXtZUxuqpyx9sa4Ta92pki3cqoU19ABj3aAJNR2fM+WbKkwKqTCkIbfMhgoQS3WyxrNMW9jmPeEVnAVu5f5df4HqsGn2ciApTy0r81j8HwuYeiuIr1xqJdvfVmwGZ1K/fFRLvzemCMzizvQYYI9DYlaWo+9SRKH2b8V2dFt1G4pPGjhOO7AKZ1Bof9g8lD3dgUtM85mu/bT+9PaXPlvafJ1KbWwDgjtDSeBkckidHMmO0nHS2T+/pnigUO/rxy4vJk9Jve8abQDlTLwxzsVMbxX3Lr+/oLSOS1wQaqGdUs3IKh4/5IwibL4ADfsJt+OYAPX3r0EaItrSXSuukM/Eh4BN33yvWnHkiOrWz7CCT6oAsS5gzM9t7lQL1K4k0RfsrJzBecxEoW1mLa+X/s9/ntrt4+VYKtDKHCWYGJHqCEkTekqZqBsUbE9RG8CfWifuPNdTTPf7XNoCT/9ePtw8wuekYX6dLZM+TzwtUkssAoHtV7QtD9wA7tH5Y9nTwOS0HCA6bIpNN/jybhgK4pv4tJV9wbJSw9UNpzeTCliR2UYVqqAa8fB5Q8PEhmt4iEeoJyWqgndg2dchZG/aCwn3HEiU/nJRiQhO1oIdwVdz37qgxEdm0CbU+ogiUdgz1s8NRkQIiBIv/9NSLAciwlnXNpEe+8DGXt5kyKcgtOdUQfDAvEqrwGtL/15xGDgWCKc5ggX2iEMWTnQs0eHmuHq1oqcCZ6KUr82i9KNDWF2Ll6HVKES0Io7o5LQBo4lhSWSKh2jqkaymkNHXllctI1SWMDpArQ9QogQtRJ1UdFQ08/It9vMfM3lRUEVBGlAXaT0j5A36TqNG++N7BsT32QggQhWll9eZjHO5g8tVjmLmrEj6CFNETC8RmehrzXc39CnZv8Ok/CXgeUV9WiFcZE6ZiZiw2TEQ4C39VE9cLLQpj9//5xy6Vvm1MFFbg8dBnpYp4IJJuJ6HYK6vzeh8WaJqHsVJD+En81DMWAT7Fi71JvBMOJ9yR8AHfMezvoJsItihZkonr/pFSLPJc6imGRHOJTJ2KFvurpzdqkN3afjMltUmXx2lH6v6It/21991ghG9F0azwmUAEtd9Ji/WcX2BVPNOFHJnfQjWx2wdbY/4On6RSFwQQwLxPHgLxjUD/Vzi2Vg6mQy9oHIGViKR0VEZCtGoUd2/XZi9CHXO8MND2bsYA02yG7H5Gg09WccToeLIBPU1zYVZH6EDoD0Ls0VSivHD+EL+Y/wsUJ7n+sz0dix7qcUyNYymTEnoXhfU20vCmHCR3tuah+YdSMydGQRHAwWpcfO0BupFNcqdG/KH2x/teUYMSI66FRLMrfJ9TRz/1Ux+bcSP5i+rt1AbEg/gdXIVh4F7+syr65SLh5sorPcn7+zg80q7BUrzlmrXC4TRQ7DRkPkNt0zib29AkuDl3kf1qxGD4DOH4OFBrLYGaMchCVrUMKwv9II3BItOjF84AXtvGbKZpYPjRZiJeFVLMgWLegrWNfkxZeuwKFbCculkZ/5uJxAYTgDdWsFjtfWrfzpkq4oLH573QfIfeda4Jr12zjbzN/71GgKDNhiDqyvUeCTH0TMv/pielNKf9jayNZDNapCtVeq3lzpTK0VWinL+ICz5KAgHCZcn7gwALgr+MnM1AmDBqUXCl+H29a/U8HVStMYSro3oL9rPvqB3x3R+21dUf6MsZQ1SZbZIwS3WtBhetGpcvYRUt4+sAlafFMtxK+4A02E8gIstJwk17Pk4a0pRczuFtHr99TC/JyEh+CTOzYtqnl3Apkwz2w7+79z26Jxw7ubt8VBNhPVQagU6p8L+06gax5LNCnO3CMecS2HLN0vzzFKqvJLRdHRdjh2GHYXaU+4Xw3KlkBCBtV1ksYLtE6cRqMvp9m6Rs85W2b9vgphmg/tzCve95rfiH5ikZIQJBTdpNyrT/JML1azS1nRcNI2KqCa6wJkaNPHWMK4VEdwojgljx5ZoeJJfavv2IpzYzC/LAMCL8ZNdm35B+MU2v0WYRuo0wAjmYYFC8tywJqP31dnSKV6fJwi1jeyx9Iw00x+E09VopA1HS4P5+0861MRM9JUQyTKNm+d/Lmfl+gCBkJVaTLKmzS5LHp17fhRUMYl7bGe4JM78LZCnpXvwACGrJ129HycztQQr7MWXPTsta4HFGXOGe9UHdjOogSZLKNx2Mv0ZRjacP1Ya4rLkEqE8YosUkJkjnRmWzlsplDqpger/2uubYhXAsHkRR+mwu1+AeeBK/2avjXpBJQx5kuBi6X/3aEuuJG9X7E1oGdHCARAN9hRhQbr5f8lZZG98NxOGlyunxuLfEH6ZWjgdFUVV9ScXk+aRUFiE4PK3lHAH4cedmKBAUTdZSSDnrDdigTcMrsLeE1rru94tZ/JQrDuxRpk0ETIAC/I3rSsFhV6qOlWAEETKGMQNdJClkUJ+KkLZr9XpVD0krSrDItP1YBi3D2xTmxOgGZhA4z+NhJrcqYG8Mb5o+XKGHrIcM6LVezOLXNjmvYLCtlsK75nTMDsXYWuGUu9riHcAFL6v/+poAa6qZg4ew99i+KgkfYFEATj1tKvVb0FK6TFdDPRnYKvdP93urJi8wV+mLY+caHT+BqkBIk3WKAg7CIB26OjDSDFGUmZM+HqgVJPTGrCNXEWqkNna0Naqq0nFtllBwHY5Gy48SrtP1Itxtc8Who2OpykyLbT+NW5+gFrAPI9p7Jqh0n1y35IHKI3yXISihIB0gWfq2FuVpFQAT7s3UwKPuEyepJARRTytqVp6f5zZX2C4yp2Dz8l2QjfNnWMkBwpm90jJ7fHBtG5Lq0VyvUlEjv9J8tQpkfShc9jB6IVzVR4q0OqxrJgx9OwIJ8wyOvnO5oCWA9y6+Ddv4WFmQr+CFHvAkgrmkzqxaNGCD8LZt20VapMq70rgpZ6OReV+PRj7uPjL18KBd1CtNI2Rb+iBm8+2pl8fM/Lp4jVMPk6E6zjZPF59L41FAv/aooAQfQYk4cTbsbnTv4yJxponHxr8QZ8CwWWdY8cIp5DEChMHw3Ub4qTFkEiRenZz+wuUJJmtbPwCM3VRQtztcGpBgAhF/1kcsytGldEmRCx7BuXC7gaFx3SlZNItaLVefkkFt6bDHDYfKxo/YiTinAGG4U7Si3W/n8DGP5xx3bszULwVaiIChTFqrhrSaC510PIshYOStbVKgIEFM8HoGNTFlgREPYwcpNUyETi1p0gpqKOzdw5EN/EMZuCOiiAaTM1GMWre8Hg77xAntFI6WzU8BjPVJspk54rcu8ilUJvHdI7Jilvf+pJQ1qs8YLTFkBGBAeGcbRak/4bX3VgfuTCAsTsx2+iKKNapysCqsmjWa/Fo8L5hHhT1Y4ERyzW+QL51uZlFeAM873lAH2sCum2DCs2AgUGGQ8v4ZWYt2s/KLO1vtAE7ND9yreqmxSXpTdj/F/cddyS/neRABr8n2SB8R3tJjLL+uo7de0MMkSBMli85WOJwyo52rtf2S9dPkGjX7odVwWQdagi+7JQf1Uez4NPA+20kUm5XSIvIy6X09wRR6BlJbEYpZL0I/C/9gxTRbs2rVUYSaokg0BOvzBABE4+fwdHf9MAYvDhx7UBs/FtCCBPaQlxOtBlX0z8Rz2zPDRfRgBokZ41kRR5hqBgmbq58OgAjDHcBNNE3VGu2mFCT8C16+9QS5o2TBgdy9T+Rsv2yrwwDzp6vlVb87EOKsSK9LC39lr+bn1VZ25MhS0PjB97Z+z944oNGqj6rv5fZlWUkVu9XUUByfVlfKW44JUyGAdKcItD8oGaHDOTs/Sh9fHH5OKResIouG1N37IbSxZhcOUgfkH7BeOPU9akzSTzsXWW5iRjxCRO3/HHBDUsdglXRjDFhJKvyTR44PkIzdJaUDOeFilsoReVSK4Tfcv+IamDS7i9KPTGFbMSdZOwWjYXtEF4Rjtb3nfGo0lI3YX8dVKOlvlAHGj1dJYtBYBfUOOSe8/HjtwdS+bDZM4LB3Jm+lc7Ge99BHU6O6tao4FgGSVruF80vwQquvh3MCkYnoxy3m0Z6z0SyzOUvB0T9nzfMDkv6z87sAc57cLhF4dDMapGcLOhykrh2uDRMvx31AjDdBIEYd2CMhnYGqtUJ3BZC3kpMNUEa1DeIvlxEazQAguGgezMcBzx179j+tgNt+E8m5rtMK064CMXCKDuKh57ajq3GxvZtO8HGh9/fynHDZybMjTOrK7FZ/zu/SLci5pCagBpQ5Zs0GadniwKg7U6wdQJ42AzhM6bAwK62/6/I8KCcs71oSnvGNaeVC1AV+GQnnCNvkiygvcw8046MQdrarBxDqdMO4MWLN9VDxCKeeBIo6jEzqSMDJKwod5epa6ELahLf6n4eRipgETNbGJxtYajhscFby6WftBnza0DfLfdMAPVHUAtGzfHgQiNWSGdRG30PKC86sm9YXU1xSoIMGV54IS1ysnbzZlAD17fARg0k721s10dM99UXwElRcmjbKkii8Zj9Z/9I5Sve8jKH6/KmSgphllC8iDp121TegD0XxKecPB4fRWpriCi3gVJtsBySgD7qtxNRN5FNX6uTC59dTDq0bQbERejn+0DsloEzkZ4kTYWoigoKYSGvuc0Ja9pkDMZaXl3NlNvRng5SLMVVYBnp+/4EMgBg4/MO/TdZ3jGBc8jBk0LCu7Whc80ElE0gPvv3RRwarOTu4lhnmAAPAbcylIPF4zhaeF/BLfkrZdCZrXfPk7ycmrTeNtOsb0GrG7rOMq3hZN7Dk+QHtFnj1gxmev3eFuckd15IqrcEqi8CeVbu/C8XLeb/W9AGdSm1p+sVFsl8ib10/r9QjrLeBjUCcrKTsDzfTC7p7IG0Jzut6YXm4pUMDyiXAXcaoC8j+CTyAr28SH1qr01laqj48cT89RpirfP3HrWY4DfIuf8YuZWJBnfH+wA2isuN6r4fYyKOWsv7Ya9p08GWXvQ7AhUvZRHsWc8N+/K3FN2FfdkpY5gfZw7jTX8LsKM62wITX99AfKk0UN7NnzCHa6MRXrzXQGBzTyatNJPVjaLZNEhCtad7keD6krGO3aI/8eJQ0/M00ExBZ34wKJttah4pJCE55IygjyKxxBAnMaezGySCOVFS8i0++f90eAK5NLp8jdYyFAFR/SBv/sWtjlJsKQk/ROFZxt5Erb4x8wcIIoITF9R9Wjz3NXEwECmx3H4tkLn1Ch04M6aERZIVs3QwIZH4VuqqG4K2gwAHeJW7ZKqlYDko6h3u4cNCBGpsSDMDL3iEap+XcDFyawA7mGOJjILQLkst8z36/rfv2dpLv9xuSnwgP+YvbsvDzbuNVPwgg6BWvf+5G4FcxxH+9PK1nbCwbIg2ixOZmSWtr/w9hT7zazrCtJqrMrjQW1Gb9VNutoVS1SSUBQgrSZ880Z3Q4zqFBFSpQbVuozlQJ9ASwExQ5mC39IHGLSxfTZHttzrGPEHnwL25zqt+QwM2SJA7W4fFiELCRD4HX3WETrWozXWZuZMLFWZn/xLEFSHlapOJnCjWc+21up43ImBvTHjJTnTlOYJXHxUPOkPSa2lqBNa/a2IeLJpX29qANFMa4FWlC8tE/09/f/PCZnGd2q1txGWeRlXiJfjnwHFcu2FQhzhgMSLjrOiZP9rdMAC1rP1jsoyRTfj+oTHq6mZV9R2GeN0u1GBXso3GSZOE9SCfVg7STo6ZihzaTM41b+82Azuur1RaAe4N0AoOtzBccd6JCvzhVfhnz0zy+sQn2hDOb3JbN6zDe2LhcZD46WV3fQEwqgLXSw83lflrJvbKguPlTXrxwwYckAdhcq6KVJCU18aFn4qq6VOrMQ6k56WggyB0tj8i6xPXUN0TIWg325GtZxFHB2NlmSSgEX2p0J6wRB9aVyF4dmYqr8JZm/UemkIRvELOX219ZQY8uiOTyprfb11XFQm1fhMTgkD2yVaXMZxZu/aOT6igBhrbwmJIZgDOGRUfV7ALVcH+bLhP/E2nTHjIGa+BAvFWLZEZ6seppxmSbYc/G5MBrWsiPyKrQQmszX+wYAqqD3VFaCM+WsGSCVlW+Mk2WH4FBnyqbC264iwQQ19p/rnKUrVd/mGUAwOlrlYmAG9Bi26uWFocD5hDX1oif+H/HEPbpqnAOhhmaJu6sbxEQOZi9JZfO7HUgPIaskxIZIRosz+opA35ayHz7KKP3CExX7uyYuP9hjtICZ5xOAykP813hCXTInZXkOBvWclZmJvzOrXQNQw2inaxJAbWh3qufLYypZZxJrat688fGwF4EfQlpn08NKQvsjvh2/Dv5Fk4EIfladrnxG1hK7ApctGmdyH/+ADPXNcx2nCk/8FYVhVLqMWwukCqnES+NUM6dCZu3ekRzGGH/CQ97wAoU6Hf4zoHDLlZOJc0JHbOUkWTkOYZSpKRzJQAdBIqgVhXqZ7tQ0lvMEOe3qALjre+ZjlaPOgpWqZjlFz0YGJmxUkV3KV2DNxUuSchCWe23K1HHsrLZfF38OsgUNdxd7TDF++5fTVNZLarIP487+6R/gFMf8YVQHYDd+PuLxZIIwifjPXMKnv6WNhJQMB9scsfAzC+e/rs6NxVUzjZgzMa5qegAqT4Y3mQ7Yuz5fRsVqkNGHezTIwBxkBhwjeZOTZI0G7hTevV8EXB7g7nbXz5FtsNakKxk6ATfX+ClaQG5qzymKYeFnX8QjK5OODMBP6yzwArMMKxwi5K2S8NEfw9wnL4h9USN9ijsfb0zFTsvU+NL/fXVew9cAfkGc4T3WtCQ6jJzfQtEDQFnmhHqxmYFanorT/AovD/0QfHfcG687HBI/bR3OwEAuH/OPgQ4Lp0/y41PHTdz6abk0D09DzQT1lMv9riQdyB5wL9+d0LU1rhUjJe8GJk+ZATmuhSYIn23wIrf7tIur8CbZ8bZsVq3+Nmbr4jowwiCA0wLaYQd39Qqu4BGwrrF6ZxcQyrsJcpyqBYW8NeJYeUmgJUIozFkZPEpUFSsBAMaAKTDPWMmkJso61+czWIISyC7CxWbJ1LI6dq4IC8kRi6gVeqg3ylS+q/tJcuAaql8O9Lc9+B5xaZdRLxKWRHktGqsXii9H/J9h4V85KorDSHwdBerFCFZpRtmxr8fvzF4ZawuEfRFwjCU16hWXL7I3KsYw0As3/QJgkAnMtM7zF/26qLAUqc017RPDztCEeEq2FitOVteAGH6xcCmEoNUN25RjGh1y4stqbhgRUKGcJsDkD4mgc2na6Lm3kpVC/vINmM5idKSqhmtWdiBabjqTDOGNyQjRJ2ue+p3VcRjd00J+xAImIM74PJtMBVO4FiwYjvaQpReC1OOursK9w+mAK2Cqfs8tETibhf19iKLKRMUOPlJm4pJSu2gRiOGBToEO9lmA4nVXdmHdON/xQRLt123QgyktoJPMIAA";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { aviso?: string } =>
    typeof s["aviso"] === "string" ? { aviso: s["aviso"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar — Gestão da Vara Criminal" },
      { name: "description", content: "Acesso restrito aos servidores da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Entrar — Gestão da Vara Criminal" },
      { property: "og:description", content: "Acesso restrito aos servidores da Vara Criminal de Coração de Maria/BA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const { aviso } = Route.useSearch();
  const navigate = useNavigate();
  const solicitar = useServerFn(solicitarAcesso);
  const trocarSenha = useServerFn(trocarSenhaObrigatoria);

  const [modo, setModo] = useState<"entrar" | "solicitar" | "trocar">(
    aviso === "troca_senha" ? "trocar" : "entrar",
  );
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLockAtivo, setCapsLockAtivo] = useState(false);
  const [lembrarEmail, setLembrarEmail] = useState(false);
  const [ajudaSenha, setAjudaSenha] = useState(false);
  const [erro, setErro] = useState(
    aviso === "inativo" ? "Seu usuário está inativo. Procure o Administrador." : "",
  );
  const [statusAcesso, setStatusAcesso] = useState<"pendente" | "recusado" | null>(
    aviso === "pendente" ? "pendente" : aviso === "recusado" ? "recusado" : null,
  );
  const [sucesso, setSucesso] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem("gestao-varacrime-email");
      if (salvo) {
        setEmail(salvo);
        setLembrarEmail(true);
      }
    } catch {
      // O navegador pode bloquear o armazenamento local; o login continua normalmente.
    }
  }, []);

  const trocarModo = (novo: "entrar" | "solicitar") => {
    setModo(novo);
    setErro("");
    setStatusAcesso(null);
    setSucesso("");
    setAjudaSenha(false);
    setSenha("");
    setConfirmarSenha("");
    setMostrarSenha(false);
    setCapsLockAtivo(false);
  };

  const campoSenha = (
    valor: string,
    aoMudar: (valor: string) => void,
    autocomplete: "current-password" | "new-password",
  ) => (
    <div className="relative">
      <input
        type={mostrarSenha ? "text" : "password"}
        autoComplete={autocomplete}
        required
        minLength={autocomplete === "new-password" ? 6 : undefined}
        maxLength={72}
        className={`${CLASSE_CAMPO} pr-10`}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => setCapsLockAtivo(e.getModifierState("CapsLock"))}
        onKeyUp={(e) => setCapsLockAtivo(e.getModifierState("CapsLock"))}
        onBlur={() => setCapsLockAtivo(false)}
      />
      <button
        type="button"
        aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        onClick={() => setMostrarSenha((v) => !v)}
      >
        {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      {capsLockAtivo && !mostrarSenha ? (
        <p className="mt-1 text-xs font-medium text-atencao">Caps Lock ativado</p>
      ) : null}
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${FUNDO_LOGIN}")` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:justify-end lg:px-12 xl:px-20">
        <div className="w-full max-w-md rounded-xl border border-white/60 bg-white/95 p-6 text-slate-950 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-6 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-slate-900 shadow-sm">
              <Scale className="size-5 text-white" />
            </span>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Central de Gestão da Vara Criminal</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Fórum Juiz João Leal</p>
            <p className="mt-0.5 text-xs text-slate-500">Comarca de Coração de Maria/BA · Acesso interno</p>
          </div>

        {modo !== "trocar" ? (
          <div className="mb-5 grid grid-cols-2 rounded-md border border-border bg-muted/40 p-1 text-sm">
            <button
              type="button"
              className={`rounded px-3 py-2 font-medium ${modo === "entrar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => trocarModo("entrar")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`rounded px-3 py-2 font-medium ${modo === "solicitar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => trocarModo("solicitar")}
            >
              Solicitar acesso
            </button>
          </div>
        ) : null}

        {modo === "entrar" ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setEnviando(true);
              setErro("");
              setStatusAcesso(null);
              setSucesso("");
              setAjudaSenha(false);

              const { data: login, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: senha,
              });

              if (error) {
                setEnviando(false);
                setErro("E-mail ou senha incorretos.");
                registrarFalhaLogin({ data: { email: email.trim() } }).catch(() => {});
                return;
              }

              try {
                if (lembrarEmail) {
                  window.localStorage.setItem("gestao-varacrime-email", email.trim());
                } else {
                  window.localStorage.removeItem("gestao-varacrime-email");
                }
              } catch {
                // Se o armazenamento local estiver bloqueado, não impede o acesso.
              }

              const id = login.user?.id;
              const { data: usuario } = id
                ? await supabase
                    .from("usuarios")
                    .select("status_cadastro, ativo, troca_senha_obrigatoria")
                    .eq("id", id)
                    .maybeSingle()
                : { data: null };

              const decisao = decidirAcessoAposLogin(usuario);

              if (decisao === "pendente") {
                await supabase.auth.signOut();
                setEnviando(false);
                setStatusAcesso("pendente");
                return;
              }

              if (decisao === "recusado") {
                await supabase.auth.signOut();
                setEnviando(false);
                setStatusAcesso("recusado");
                return;
              }

              if (decisao === "inativo") {
                await supabase.auth.signOut();
                setEnviando(false);
                setErro("Seu usuário está inativo ou não possui acesso liberado. Procure um administrador da unidade.");
                return;
              }

              if (decisao === "trocar_senha") {
                setEnviando(false);
                setSenha("");
                setConfirmarSenha("");
                setModo("trocar");
                return;
              }

              setEnviando(false);
              await registrarAcesso({ data: { acao: "Login" } }).catch(() => {});
              navigate({ to: "/", replace: true });
            }}
          >
            <Campo rotulo="E-mail">
              <input
                type="email"
                autoComplete="email"
                required
                className={CLASSE_CAMPO}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>

            <label className="-mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={lembrarEmail}
                onChange={(e) => {
                  setLembrarEmail(e.target.checked);
                  if (!e.target.checked) {
                    try {
                      window.localStorage.removeItem("gestao-varacrime-email");
                    } catch {
                      // Sem impacto no login.
                    }
                  }
                }}
              />
              Lembrar meu e-mail neste dispositivo
            </label>

            <Campo rotulo="Senha">{campoSenha(senha, setSenha, "current-password")}</Campo>

            <div className="-mt-2 text-right">
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  setAjudaSenha(true);
                  setErro("");
                  setStatusAcesso(null);
                }}
              >
                Esqueci minha senha
              </button>
            </div>

            {ajudaSenha ? (
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold">Redefinição de senha</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Procure um administrador da unidade. Ele poderá redefinir sua conta para a senha padrão.
                  No próximo acesso, o sistema exigirá que você cadastre uma nova senha.
                </p>
              </div>
            ) : null}

            {statusAcesso === "pendente" ? (
              <div className="rounded-md border border-atencao/30 bg-atencao-suave p-3">
                <p className="text-sm font-semibold text-atencao">Aguardando aprovação</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Seu cadastro foi recebido, mas o acesso ainda precisa ser aprovado por um administrador da unidade.
                </p>
              </div>
            ) : null}

            {statusAcesso === "recusado" ? (
              <div className="rounded-md border border-urgente/30 bg-urgente-suave p-3">
                <p className="text-sm font-semibold text-urgente">Acesso não autorizado</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Sua solicitação de acesso foi recusada. Procure um administrador da unidade.
                </p>
              </div>
            ) : null}

            {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

            <button
              disabled={enviando}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        ) : modo === "solicitar" ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setEnviando(true);
              setErro("");
              setSucesso("");

              try {
                if (senha !== confirmarSenha) {
                  setErro("As senhas não coincidem.");
                  return;
                }
                await solicitar({ data: { nome, email, senha } });
                setSucesso("Solicitação enviada. Seu acesso ficará disponível após a aprovação de um administrador.");
                setNome("");
                setEmail("");
                setSenha("");
                setConfirmarSenha("");
              } catch (e) {
                setErro((e as Error).message);
              } finally {
                setEnviando(false);
              }
            }}
          >
            <Campo rotulo="Nome completo">
              <input
                autoComplete="name"
                required
                minLength={3}
                className={CLASSE_CAMPO}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Campo>
            <Campo rotulo="E-mail">
              <input
                type="email"
                autoComplete="email"
                required
                className={CLASSE_CAMPO}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>
            <Campo rotulo="Senha">{campoSenha(senha, setSenha, "new-password")}</Campo>
            <Campo rotulo="Confirmar senha">
              <input
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                className={CLASSE_CAMPO}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
            </Campo>
            {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
            {sucesso ? (
              <p className="rounded-md border border-concluido/25 bg-concluido-suave p-3 text-sm text-concluido">
                {sucesso}
              </p>
            ) : null}
            <button
              disabled={enviando}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Enviar solicitação"}
            </button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setErro("");

              if (senha !== confirmarSenha) {
                setErro("As senhas não coincidem.");
                return;
              }

              setEnviando(true);
              try {
                const { data: sessaoAtual } = await supabase.auth.getSession();
                const accessToken = sessaoAtual.session?.access_token;

                if (!accessToken) {
                  setErro("Sua sessão expirou. Entre novamente com a senha padrão.");
                  setModo("entrar");
                  return;
                }

                await trocarSenha({ data: { senha, accessToken } });

                // Reabre a sessão com a nova senha para não manter credencial
                // temporária ou token antigo após a redefinição.
                await supabase.auth.signOut();
                const { error: novoLoginErro } = await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password: senha,
                });

                if (novoLoginErro) {
                  setSucesso("Senha alterada com sucesso. Entre novamente usando a nova senha.");
                  setModo("entrar");
                  setSenha("");
                  setConfirmarSenha("");
                  return;
                }

                setSucesso("Senha alterada. Acesso liberado.");
                await registrarAcesso({ data: { acao: "Login" } }).catch(() => {});
                navigate({ to: "/", replace: true });
              } catch (e) {
                const mensagem = e instanceof Error ? e.message : "Não foi possível alterar a senha.";
                setErro(
                  /authorization header|unauthorized/i.test(mensagem)
                    ? "Não foi possível validar sua sessão. Entre novamente com a senha padrão."
                    : mensagem,
                );
              } finally {
                setEnviando(false);
              }
            }}
          >
            <div className="rounded-md border border-atencao/30 bg-atencao-suave p-3">
              <p className="text-sm font-semibold text-atencao">Crie uma nova senha</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Você entrou com a senha padrão definida pelo administrador. Antes de acessar o sistema,
                escolha uma nova senha pessoal.
              </p>
            </div>

            <Campo rotulo="Nova senha">{campoSenha(senha, setSenha, "new-password")}</Campo>
            <Campo rotulo="Confirmar nova senha">
              <input
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                className={CLASSE_CAMPO}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
            </Campo>

            {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

            <button
              disabled={enviando}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? "Salvando…" : "Definir nova senha"}
            </button>
          </form>
        )}

          <p className="mt-6 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
            O cadastro não libera acesso automaticamente. Um administrador da unidade precisa aprovar a solicitação e definir o perfil.
          </p>
        </div>
      </div>
    </div>
  );
}
