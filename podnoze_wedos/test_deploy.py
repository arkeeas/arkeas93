import ftplib
import unittest
from unittest.mock import patch

import deploy


class SessionReuseTests(unittest.TestCase):
    def test_data_tls_socket_reuses_control_session(self):
        session = object()

        class ControlSocket:
            pass

        class RawSocket:
            pass

        control = ControlSocket()
        control.session = session

        class Context:
            def __init__(self):
                self.kwargs = None

            def wrap_socket(self, sock, **kwargs):
                self.kwargs = kwargs
                return sock

        context = Context()
        ftp = deploy.SessionReuseFTP_TLS(context=context)
        ftp.host = "ftp.example.test"
        ftp.sock = control
        ftp._prot_p = True

        with patch.object(ftplib.FTP, "ntransfercmd", return_value=(RawSocket(), 12)):
            sock, size = ftp.ntransfercmd("RETR index.html")

        self.assertEqual(size, 12)
        self.assertEqual(context.kwargs["server_hostname"], "ftp.example.test")
        self.assertIs(context.kwargs["session"], session)


if __name__ == "__main__":
    unittest.main()
