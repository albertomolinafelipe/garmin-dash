{
  description = "Reproducible development environment for garmin-nhost";

  # The lock file freezes the nixpkgs revision and nhost-cli version.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in {
      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nhost-cli
              nodejs_22
              docker-client
            ];

            shellHook = ''
              echo "garmin-nhost shell: nhost $(nhost --version | tail -n1), node $(node --version)"
            '';
          };
        });
    };
}
