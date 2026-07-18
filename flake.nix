{
  description = "garmin-dash — native dev shell (Python + Node) for out-of-container hot reload";

  # Pinned to a stable release channel: its package set is curated to build
  # together (unstable snapshots occasionally ship a broken logfire/opentelemetry
  # combo). Bump deliberately.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";

      # logfire (a garth dep) has an over-strict pythonRuntimeDepsCheck in nixpkgs
      # that fails the build; relax it. See project memory `garmin-dash-env`.
      overlay = final: prev: {
        pythonPackagesExtensions = prev.pythonPackagesExtensions ++ [
          (pyfinal: pyprev: {
            logfire = pyprev.logfire.overridePythonAttrs (_: {
              dontCheckRuntimeDeps = true;
            });
          })
        ];
      };

      pkgs = import nixpkgs {
        inherit system;
        overlays = [ overlay ];
      };

      # Python 3.14 (channel default) breaks garth→logfire; pin 3.12 to match the
      # Docker image (python:3.12-slim).
      python = pkgs.python312;
      pythonEnv = python.withPackages (
        ps: with ps; [
          fastapi
          uvicorn
          watchfiles # uvicorn --reload
          uvloop
          httptools
          websockets
          python-dotenv
          sqlmodel
          garminconnect
          garth
          fitdecode # .fit parsing for per-activity time-series
          pyyaml # strength exercise catalog (exercises.yaml)
        ]
      );
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pythonEnv
          pkgs.nodejs_22
          pkgs.just
        ];
        shellHook = ''
          echo "garmin-dash dev — python ${python.version} · node $(node --version) · run 'just dev'"
        '';
      };
    };
}
