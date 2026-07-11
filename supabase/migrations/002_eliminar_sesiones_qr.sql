-- Ejecutar en Supabase → SQL Editor
--
-- Se retira el flujo de QR de auto-asistencia: quedó a medias (se generaba
-- el QR y se guardaba la sesión, pero nunca hubo página pública funcional
-- que dejara al alumno marcarse presente). En vez de completarlo, se retira
-- por completo para no confundir al profesor con un botón que no hace nada.

drop table if exists sesiones_qr;
